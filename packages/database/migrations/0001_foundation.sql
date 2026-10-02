-- The migration owner is separate from the non-superuser application role.
CREATE ROLE olaph_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE memberships (tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL,role text NOT NULL,permissions text[] NOT NULL DEFAULT '{}',active boolean NOT NULL DEFAULT true,PRIMARY KEY(tenant_id,user_id));
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON memberships FOR SELECT TO olaph_runtime USING(user_id=current_setting('app.user_id',true) AND active);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY own_tenant ON tenants FOR SELECT TO olaph_runtime USING(id::text=current_setting('app.tenant_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=tenants.id));
CREATE TABLE materials(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),code text NOT NULL,name text NOT NULL,unit text NOT NULL,quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK(quantity>=0),minimum numeric(18,6) NOT NULL DEFAULT 0 CHECK(minimum>=0),custom_fields jsonb NOT NULL DEFAULT '{}',UNIQUE(tenant_id,code),UNIQUE(tenant_id,id));
CREATE TABLE partners(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,kind text NOT NULL CHECK(kind IN('customer','supplier','both')),custom_fields jsonb NOT NULL DEFAULT '{}',UNIQUE(tenant_id,id));
CREATE TABLE products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),code text NOT NULL,name text NOT NULL,unit text NOT NULL,custom_fields jsonb NOT NULL DEFAULT '{}',UNIQUE(tenant_id,code),UNIQUE(tenant_id,id));
CREATE TABLE recipes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),product_id uuid NOT NULL,material_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id));
CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),code text NOT NULL,partner_id uuid,due_date date NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','done','cancelled')),UNIQUE(tenant_id,id),UNIQUE(tenant_id,code),FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id));
CREATE TABLE order_lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),order_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
CREATE TABLE warehouses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,owner_partner_id uuid,UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,owner_partner_id) REFERENCES partners(tenant_id,id));
CREATE TABLE stock_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),material_id uuid NOT NULL,warehouse_id uuid,quantity numeric(18,6) NOT NULL CHECK(quantity<>0),note text NOT NULL DEFAULT '',idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),FOREIGN KEY(tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id));
CREATE TABLE purchase_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),material_id uuid NOT NULL,partner_id uuid,quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit_price numeric(18,4) NOT NULL CHECK(unit_price>=0),currency char(3) NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),approved_by text,FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id));
CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),actor_id text NOT NULL,entity text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,old_value jsonb,new_value jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  INSERT INTO audit_log(tenant_id,actor_id,entity,entity_id,action,old_value,new_value) VALUES(COALESCE(NEW.tenant_id,OLD.tenant_id),COALESCE(NULLIF(current_setting('app.user_id',true),''),'migration'),TG_TABLE_NAME,COALESCE(NEW.id,OLD.id),TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE NULL END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
  RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION audit_change() FROM PUBLIC;
DO $$ DECLARE tbl text; perm text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['materials','partners','products','recipes','orders','order_lines','warehouses','stock_movements','purchase_requests'] LOOP
    perm:=CASE WHEN tbl IN('orders','order_lines') THEN 'orders' WHEN tbl IN('stock_movements','warehouses') THEN 'stock' WHEN tbl='purchase_requests' THEN 'purchasing' ELSE 'catalog' END;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
    EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT TO olaph_runtime USING (tenant_id::text=current_setting(''app.tenant_id'',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=%I.tenant_id AND %L=ANY(m.permissions)))',tbl,tbl,perm||':read');
    EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO olaph_runtime WITH CHECK (tenant_id::text=current_setting(''app.tenant_id'',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=%I.tenant_id AND %L=ANY(m.permissions)))',tbl,tbl,perm||':write');
    EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO olaph_runtime USING (tenant_id::text=current_setting(''app.tenant_id'',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=%I.tenant_id AND %L=ANY(m.permissions))) WITH CHECK (tenant_id::text=current_setting(''app.tenant_id'',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=%I.tenant_id AND %L=ANY(m.permissions)))',tbl,tbl,perm||':write',tbl,perm||':write');
    EXECUTE format('CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_change()',tbl);
    EXECUTE format('CREATE INDEX ON %I(tenant_id)',tbl);
  END LOOP;
END $$;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_audit ON audit_log FOR SELECT TO olaph_runtime USING(tenant_id::text=current_setting('app.tenant_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=audit_log.tenant_id AND 'audit:read'=ANY(m.permissions)));
GRANT USAGE ON SCHEMA public TO olaph_runtime;
GRANT SELECT ON tenants,memberships,audit_log TO olaph_runtime;
GRANT SELECT,INSERT,UPDATE ON materials,partners,products,recipes,orders,order_lines,warehouses,purchase_requests TO olaph_runtime;
GRANT SELECT,INSERT ON stock_movements TO olaph_runtime;
-- No runtime DELETE, no membership writes, no audit insert/update/delete.
-- A separate authenticated service is required before exposing business endpoints.
