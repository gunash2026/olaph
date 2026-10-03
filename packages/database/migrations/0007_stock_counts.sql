CREATE TABLE stock_counts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 material_id uuid NOT NULL,
 warehouse_id uuid NOT NULL,
 expected_quantity numeric(18,6) NOT NULL CHECK(expected_quantity>=0),
 counted_quantity numeric(18,6) NOT NULL CHECK(counted_quantity>=0),
 difference numeric(18,6) NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 300),
 counted_by text NOT NULL,
 idempotency_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),
 FOREIGN KEY(tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id)
);
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON stock_counts FOR SELECT TO olaph_runtime
 USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('stock:read'));
GRANT SELECT ON stock_counts TO olaph_runtime;
CREATE INDEX ON stock_counts(tenant_id,created_at);
CREATE TRIGGER audit_row AFTER INSERT ON stock_counts FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE FUNCTION confirm_stock_count(p_material uuid,p_warehouse uuid,p_expected numeric,p_counted numeric,p_reason text,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; previous stock_counts; actual numeric; held numeric; rid uuid;
BEGIN
 IF NOT has_permission('stock:write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT workspace_can_write() THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
 IF p_expected IS NULL OR p_counted IS NULL OR NOT(p_expected>=0 AND p_expected<1000000000000 AND p_counted>=0 AND p_counted<1000000000000)
   OR p_expected<>trunc(p_expected,6) OR p_counted<>trunc(p_counted,6)
   OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 300 OR p_key IS NULL THEN RAISE EXCEPTION 'INVALID_STOCK_COUNT'; END IF;
 -- Serialize all confirmations with the same key, including a changed material.
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':stock-count:'||p_key::text,0));
 SELECT * INTO previous FROM stock_counts WHERE tenant_id=tid AND idempotency_key=p_key;
 IF previous.id IS NOT NULL THEN
  IF previous.material_id IS DISTINCT FROM p_material OR previous.warehouse_id IS DISTINCT FROM p_warehouse
    OR previous.expected_quantity<>p_expected OR previous.counted_quantity<>p_counted OR previous.reason<>btrim(p_reason)
    THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN previous.id;
 END IF;
 PERFORM 1 FROM materials WHERE tenant_id=tid AND id=p_material FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 PERFORM 1 FROM warehouses WHERE tenant_id=tid AND id=p_warehouse FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 SELECT quantity,reserved INTO actual,held FROM stock_balances WHERE tenant_id=tid AND material_id=p_material AND warehouse_id=p_warehouse FOR UPDATE;
 actual:=COALESCE(actual,0);held:=COALESCE(held,0);
 IF actual<>p_expected THEN RAISE EXCEPTION 'STALE_STOCK_COUNT'; END IF;
 IF p_counted<held THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;
 INSERT INTO stock_counts(tenant_id,material_id,warehouse_id,expected_quantity,counted_quantity,difference,reason,counted_by,idempotency_key)
 VALUES(tid,p_material,p_warehouse,p_expected,p_counted,p_counted-actual,btrim(p_reason),current_setting('app.user_id',true),p_key) RETURNING id INTO rid;
 IF p_counted<>actual THEN
  INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,note,idempotency_key)
  VALUES(tid,p_material,p_warehouse,p_counted-actual,'Stock count '||rid::text||': '||btrim(p_reason),gen_random_uuid());
 END IF;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION confirm_stock_count(uuid,uuid,numeric,numeric,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_stock_count(uuid,uuid,numeric,numeric,text,uuid) TO olaph_runtime;
