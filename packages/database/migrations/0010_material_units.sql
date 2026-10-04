-- A sheet, pack or length can represent a different stock quantity for each material.
CREATE TABLE material_unit_conversions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 material_id uuid NOT NULL,input_unit_id uuid NOT NULL,
 factor numeric NOT NULL CHECK(factor>0 AND factor<1000000000000 AND factor=trunc(factor,6)),
 UNIQUE(tenant_id,material_id,input_unit_id),
 FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),
 FOREIGN KEY(tenant_id,input_unit_id) REFERENCES units(tenant_id,id)
);
ALTER TABLE material_unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_unit_conversions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON material_unit_conversions FOR SELECT TO olaph_runtime
 USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('catalog:read'));
CREATE POLICY tenant_insert ON material_unit_conversions FOR INSERT TO olaph_runtime
 WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('catalog:write'));
CREATE POLICY tenant_update ON material_unit_conversions FOR UPDATE TO olaph_runtime
 USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('catalog:write'))
 WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('catalog:write'));
GRANT SELECT,INSERT,UPDATE ON material_unit_conversions TO olaph_runtime;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE ON material_unit_conversions FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE FUNCTION check_material_conversion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE stock_unit text; entered_unit text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.tenant_id,NEW.material_id,NEW.input_unit_id) IS DISTINCT FROM (OLD.tenant_id,OLD.material_id,OLD.input_unit_id) THEN
  RAISE EXCEPTION 'CONVERSION_REFERENCE_IMMUTABLE';
 END IF;
 -- Serialize coefficient changes with stock posting and material unit edits.
 SELECT unit INTO stock_unit FROM materials WHERE tenant_id=NEW.tenant_id AND id=NEW.material_id FOR UPDATE;
 SELECT code INTO entered_unit FROM units WHERE tenant_id=NEW.tenant_id AND id=NEW.input_unit_id;
 IF stock_unit IS NULL OR entered_unit IS NULL THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 IF stock_unit=entered_unit THEN RAISE EXCEPTION 'CONVERSION_REQUIRES_DIFFERENT_UNIT'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION check_material_conversion() FROM PUBLIC;
CREATE TRIGGER check_conversion BEFORE INSERT OR UPDATE ON material_unit_conversions FOR EACH ROW EXECUTE FUNCTION check_material_conversion();

CREATE FUNCTION protect_material_stock_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.unit IS DISTINCT FROM OLD.unit AND (
  EXISTS(SELECT 1 FROM material_unit_conversions WHERE tenant_id=OLD.tenant_id AND material_id=OLD.id)
  OR EXISTS(SELECT 1 FROM stock_movements WHERE tenant_id=OLD.tenant_id AND material_id=OLD.id)
  OR EXISTS(SELECT 1 FROM recipes WHERE tenant_id=OLD.tenant_id AND material_id=OLD.id)
  OR EXISTS(SELECT 1 FROM material_requirements WHERE tenant_id=OLD.tenant_id AND material_id=OLD.id)
  OR EXISTS(SELECT 1 FROM purchase_requests WHERE tenant_id=OLD.tenant_id AND material_id=OLD.id)
  OR EXISTS(SELECT 1 FROM supplier_quotes WHERE tenant_id=OLD.tenant_id AND material_id=OLD.id)
 ) THEN RAISE EXCEPTION 'MATERIAL_UNIT_IN_USE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION protect_material_stock_unit() FROM PUBLIC;
CREATE TRIGGER protect_stock_unit BEFORE UPDATE OF unit ON materials FOR EACH ROW EXECUTE FUNCTION protect_material_stock_unit();

ALTER TABLE stock_movements ADD COLUMN input_unit_id uuid;
ALTER TABLE stock_movements ADD COLUMN input_quantity numeric;
ALTER TABLE stock_movements ADD COLUMN input_unit text;
ALTER TABLE stock_movements ADD COLUMN conversion_factor numeric;
ALTER TABLE stock_movements ADD COLUMN stock_unit text;
ALTER TABLE stock_movements ADD FOREIGN KEY(tenant_id,input_unit_id) REFERENCES units(tenant_id,id);
-- Older movements were recorded directly in the material's stock unit.
UPDATE stock_movements s SET input_quantity=s.quantity,input_unit=m.unit,conversion_factor=1,stock_unit=m.unit
 FROM materials m WHERE m.tenant_id=s.tenant_id AND m.id=s.material_id;
ALTER TABLE stock_movements ALTER COLUMN input_quantity SET NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN input_unit SET NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN conversion_factor SET NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN stock_unit SET NOT NULL;
ALTER TABLE stock_movements ADD CHECK(input_quantity<>0 AND abs(input_quantity)<1000000000000 AND input_quantity=trunc(input_quantity,6));
ALTER TABLE stock_movements ADD CHECK(conversion_factor>0 AND conversion_factor<1000000000000 AND conversion_factor=trunc(conversion_factor,6));
ALTER TABLE stock_movements ADD CHECK(quantity=input_quantity*conversion_factor);

-- Counts, transfers, reservations and legacy inserts continue to use the stock unit.
-- Runtime INSERT column grants deliberately exclude these immutable snapshots.
CREATE FUNCTION snapshot_movement_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE material_unit text;
BEGIN
 SELECT unit INTO material_unit FROM materials WHERE tenant_id=NEW.tenant_id AND id=NEW.material_id FOR UPDATE;
 IF material_unit IS NULL THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 IF NEW.input_unit_id IS NULL THEN
  NEW.input_quantity:=NEW.quantity; NEW.input_unit:=material_unit; NEW.conversion_factor:=1; NEW.stock_unit:=material_unit;
 END IF;
 IF NEW.stock_unit IS DISTINCT FROM material_unit THEN RAISE EXCEPTION 'INVALID_STOCK_CONVERSION'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION snapshot_movement_unit() FROM PUBLIC;
CREATE TRIGGER snapshot_unit BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION snapshot_movement_unit();

CREATE FUNCTION record_stock_movement(p_material uuid,p_warehouse uuid,p_quantity numeric,p_unit uuid,p_note text,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; previous stock_movements; material_unit text;
 entered_unit text; multiplier numeric:=1; converted numeric; rid uuid;
BEGIN
 IF NOT has_permission('stock:write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT workspace_can_write() THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
 IF p_quantity IS NULL OR NOT(abs(p_quantity)>0 AND abs(p_quantity)<1000000000000) OR p_quantity<>trunc(p_quantity,6)
  OR p_material IS NULL OR p_warehouse IS NULL OR p_key IS NULL OR p_note IS NULL OR length(p_note)>300 THEN RAISE EXCEPTION 'INVALID_STOCK_CONVERSION'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':stock-movement:'||p_key::text,0));
 SELECT * INTO previous FROM stock_movements WHERE tenant_id=tid AND idempotency_key=p_key;
 IF previous.id IS NOT NULL THEN
  IF previous.material_id<>p_material OR previous.warehouse_id IS DISTINCT FROM p_warehouse OR previous.input_quantity<>p_quantity
   OR previous.input_unit_id IS DISTINCT FROM p_unit OR previous.note<>p_note OR previous.transfer_id IS NOT NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  -- Retry uses the original snapshot even if the coefficient or unit label changed.
  RETURN previous.id;
 END IF;
 SELECT unit INTO material_unit FROM materials WHERE tenant_id=tid AND id=p_material FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 PERFORM 1 FROM warehouses WHERE tenant_id=tid AND id=p_warehouse FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_REFERENCE_NOT_FOUND'; END IF;
 entered_unit:=material_unit;
 IF p_unit IS NOT NULL THEN
  SELECT c.factor,u.code INTO multiplier,entered_unit FROM material_unit_conversions c
   JOIN units u ON u.tenant_id=c.tenant_id AND u.id=c.input_unit_id
   WHERE c.tenant_id=tid AND c.material_id=p_material AND c.input_unit_id=p_unit;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNIT_CONVERSION_NOT_FOUND'; END IF;
 END IF;
 converted:=p_quantity*multiplier;
 -- Never silently round stock, including conversions smaller than one millionth.
 IF NOT(abs(converted)>0 AND abs(converted)<1000000000000) OR converted<>trunc(converted,6) THEN
  RAISE EXCEPTION 'CONVERTED_QUANTITY_OUT_OF_RANGE';
 END IF;
 INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,note,idempotency_key,input_unit_id,input_quantity,input_unit,conversion_factor,stock_unit)
 VALUES(tid,p_material,p_warehouse,converted,p_note,p_key,p_unit,p_quantity,entered_unit,multiplier,material_unit) RETURNING id INTO rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION record_stock_movement(uuid,uuid,numeric,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_stock_movement(uuid,uuid,numeric,uuid,text,uuid) TO olaph_runtime;
