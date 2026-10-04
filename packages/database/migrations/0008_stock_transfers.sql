CREATE TABLE stock_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 material_id uuid NOT NULL,source_warehouse_id uuid NOT NULL,destination_warehouse_id uuid NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0),note text NOT NULL DEFAULT '' CHECK(length(note)<=300),
 transferred_by text NOT NULL,idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(source_warehouse_id<>destination_warehouse_id),UNIQUE(tenant_id,idempotency_key),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),
 FOREIGN KEY(tenant_id,source_warehouse_id) REFERENCES warehouses(tenant_id,id),
 FOREIGN KEY(tenant_id,destination_warehouse_id) REFERENCES warehouses(tenant_id,id)
);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON stock_transfers FOR SELECT TO olaph_runtime
 USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('stock:read'));
GRANT SELECT ON stock_transfers TO olaph_runtime;
CREATE INDEX ON stock_transfers(tenant_id,created_at);
CREATE TRIGGER audit_row AFTER INSERT ON stock_transfers FOR EACH ROW EXECUTE FUNCTION audit_change();
ALTER TABLE stock_movements ADD COLUMN transfer_id uuid;
ALTER TABLE stock_movements ADD FOREIGN KEY(tenant_id,transfer_id) REFERENCES stock_transfers(tenant_id,id);
-- Only the atomic transfer function may tag movements as transfers.
REVOKE INSERT ON stock_movements FROM olaph_runtime;
GRANT INSERT(tenant_id,material_id,warehouse_id,quantity,note,idempotency_key) ON stock_movements TO olaph_runtime;

CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE balance numeric; held numeric;
BEGIN
 IF NEW.tenant_id::text IS DISTINCT FROM current_setting('app.tenant_id',true) OR NOT has_permission('stock:write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NEW.warehouse_id IS NULL THEN RAISE EXCEPTION 'WAREHOUSE_REQUIRED'; END IF;
 PERFORM 1 FROM materials WHERE tenant_id=NEW.tenant_id AND id=NEW.material_id FOR UPDATE;
 INSERT INTO stock_balances(tenant_id,material_id,warehouse_id) VALUES(NEW.tenant_id,NEW.material_id,NEW.warehouse_id) ON CONFLICT DO NOTHING;
 SELECT quantity,reserved INTO balance,held FROM stock_balances WHERE tenant_id=NEW.tenant_id AND material_id=NEW.material_id AND warehouse_id=NEW.warehouse_id FOR UPDATE;
 IF balance+NEW.quantity<held THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;
 UPDATE stock_balances SET quantity=quantity+NEW.quantity WHERE tenant_id=NEW.tenant_id AND material_id=NEW.material_id AND warehouse_id=NEW.warehouse_id;
 IF NEW.transfer_id IS NULL THEN
  UPDATE materials SET quantity=quantity+NEW.quantity WHERE tenant_id=NEW.tenant_id AND id=NEW.material_id;
 ELSIF NOT EXISTS(SELECT 1 FROM stock_transfers t WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.transfer_id AND t.material_id=NEW.material_id
   AND ((t.source_warehouse_id=NEW.warehouse_id AND NEW.quantity=-t.quantity) OR (t.destination_warehouse_id=NEW.warehouse_id AND NEW.quantity=t.quantity))) THEN
  RAISE EXCEPTION 'INVALID_STOCK_TRANSFER';
 END IF;
 -- A transfer preserves the material total, so it must not generate false low-stock alerts.
 RETURN NEW;
END $$;

CREATE FUNCTION transfer_stock(p_material uuid,p_source uuid,p_destination uuid,p_quantity numeric,p_note text,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; previous stock_transfers; source_owner uuid; destination_owner uuid; rid uuid;
BEGIN
 IF NOT has_permission('stock:write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT workspace_can_write() THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
 IF p_quantity IS NULL OR NOT(p_quantity>0 AND p_quantity<1000000000000) OR p_quantity<>trunc(p_quantity,6)
   OR p_source IS NULL OR p_destination IS NULL OR p_source=p_destination OR p_key IS NULL OR p_note IS NULL OR length(p_note)>300 THEN RAISE EXCEPTION 'INVALID_STOCK_TRANSFER'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':stock-transfer:'||p_key::text,0));
 SELECT * INTO previous FROM stock_transfers WHERE tenant_id=tid AND idempotency_key=p_key;
 IF previous.id IS NOT NULL THEN
  IF previous.material_id IS DISTINCT FROM p_material OR previous.source_warehouse_id<>p_source OR previous.destination_warehouse_id<>p_destination
    OR previous.quantity<>p_quantity OR previous.note<>p_note THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN previous.id;
 END IF;
 PERFORM 1 FROM materials WHERE tenant_id=tid AND id=p_material FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 PERFORM 1 FROM warehouses WHERE tenant_id=tid AND id IN(p_source,p_destination) ORDER BY id FOR SHARE;
 SELECT owner_partner_id INTO source_owner FROM warehouses WHERE tenant_id=tid AND id=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 SELECT owner_partner_id INTO destination_owner FROM warehouses WHERE tenant_id=tid AND id=p_destination;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 IF source_owner IS DISTINCT FROM destination_owner THEN RAISE EXCEPTION 'STOCK_OWNER_MISMATCH'; END IF;
 INSERT INTO stock_transfers(tenant_id,material_id,source_warehouse_id,destination_warehouse_id,quantity,note,transferred_by,idempotency_key)
 VALUES(tid,p_material,p_source,p_destination,p_quantity,p_note,current_setting('app.user_id',true),p_key) RETURNING id INTO rid;
 INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,note,idempotency_key,transfer_id)
 VALUES(tid,p_material,p_source,-p_quantity,p_note,gen_random_uuid(),rid),
       (tid,p_material,p_destination,p_quantity,p_note,gen_random_uuid(),rid);
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION transfer_stock(uuid,uuid,uuid,numeric,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_stock(uuid,uuid,uuid,numeric,text,uuid) TO olaph_runtime;

CREATE FUNCTION protect_warehouse_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.owner_partner_id IS DISTINCT FROM OLD.owner_partner_id AND EXISTS(SELECT 1 FROM stock_balances WHERE tenant_id=OLD.tenant_id AND warehouse_id=OLD.id AND quantity>0) THEN
  RAISE EXCEPTION 'OWNER_CHANGE_REQUIRES_EMPTY_WAREHOUSE';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION protect_warehouse_owner() FROM PUBLIC;
CREATE TRIGGER check_warehouse_owner BEFORE UPDATE OF owner_partner_id ON warehouses FOR EACH ROW EXECUTE FUNCTION protect_warehouse_owner();
