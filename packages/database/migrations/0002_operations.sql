-- All application connections use olaph_runtime, never the migration owner.
CREATE FUNCTION has_permission(required text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM memberships WHERE tenant_id::text=current_setting('app.tenant_id',true) AND user_id=current_setting('app.user_id',true) AND active AND required=ANY(permissions))
$$;
REVOKE ALL ON FUNCTION has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_permission(text) TO olaph_runtime;

CREATE TABLE tenant_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,permissions text[] NOT NULL,mfa_required boolean NOT NULL DEFAULT false,UNIQUE(tenant_id,name),UNIQUE(tenant_id,id));
ALTER TABLE memberships ADD COLUMN role_id uuid;
ALTER TABLE memberships ADD CONSTRAINT membership_role_fk FOREIGN KEY(tenant_id,role_id) REFERENCES tenant_roles(tenant_id,id);
CREATE TABLE invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),email text NOT NULL,role_id uuid NOT NULL,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,accepted_at timestamptz,invited_by text NOT NULL,FOREIGN KEY(tenant_id,role_id) REFERENCES tenant_roles(tenant_id,id));
CREATE TABLE subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id),plan text NOT NULL DEFAULT 'starter' CHECK(plan IN('starter','professional','enterprise')),status text NOT NULL DEFAULT 'trialing' CHECK(status IN('trialing','active','past_due','cancelled')),trial_ends_at timestamptz NOT NULL DEFAULT now()+interval '14 days',period_ends_at timestamptz,extra_seats integer NOT NULL DEFAULT 0 CHECK(extra_seats>=0),currency text NOT NULL DEFAULT 'USD',fixed_fx numeric(18,6),provider text,provider_reference text,UNIQUE(tenant_id,id));
CREATE TABLE tenant_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id),locale text NOT NULL DEFAULT 'tr',timezone text NOT NULL DEFAULT 'Europe/Istanbul',approval_limit numeric(18,4) NOT NULL DEFAULT 0 CHECK(approval_limit>=0),features jsonb NOT NULL DEFAULT '{}',retention_days integer NOT NULL DEFAULT 365 CHECK(retention_days>=30),UNIQUE(tenant_id,id));
CREATE TABLE units(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),code text NOT NULL,name text NOT NULL,base_unit_id uuid,factor numeric(18,6) NOT NULL DEFAULT 1 CHECK(factor>0),UNIQUE(tenant_id,code),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,base_unit_id) REFERENCES units(tenant_id,id));
ALTER TABLE recipes ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE recipes ADD COLUMN component_product_id uuid;
ALTER TABLE recipes ADD CONSTRAINT recipe_component_fk FOREIGN KEY(tenant_id,component_product_id) REFERENCES products(tenant_id,id);
ALTER TABLE recipes ADD CONSTRAINT recipe_exactly_one_component CHECK((material_id IS NULL)<>(component_product_id IS NULL));
ALTER TABLE recipes ADD CONSTRAINT recipe_no_self CHECK(product_id<>component_product_id);
CREATE FUNCTION prevent_recipe_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Serialize graph changes inside a tenant so concurrent edges cannot form a cycle.
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text,0));
 IF NEW.component_product_id IS NOT NULL AND EXISTS(WITH RECURSIVE descendants(id,path) AS (
 SELECT NEW.component_product_id, ARRAY[NEW.component_product_id]
 UNION ALL SELECT r.component_product_id,d.path||r.component_product_id FROM recipes r JOIN descendants d ON r.product_id=d.id WHERE r.tenant_id=NEW.tenant_id AND r.component_product_id IS NOT NULL AND NOT r.component_product_id=ANY(d.path)
 ) SELECT 1 FROM descendants WHERE id=NEW.product_id) THEN RAISE EXCEPTION 'RECIPE_CYCLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER recipe_cycle BEFORE INSERT OR UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION prevent_recipe_cycle();
CREATE TABLE partner_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),partner_id uuid NOT NULL,material_id uuid NOT NULL,code text NOT NULL,UNIQUE(tenant_id,partner_id,code),FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id));
CREATE TABLE supplier_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),partner_id uuid NOT NULL,material_id uuid NOT NULL,unit_price numeric(18,4) NOT NULL CHECK(unit_price>=0),currency char(3) NOT NULL,lead_days integer NOT NULL CHECK(lead_days>=0),minimum numeric(18,6) NOT NULL DEFAULT 0,pack_size numeric(18,6) NOT NULL DEFAULT 1 CHECK(pack_size>0),payment_terms text NOT NULL DEFAULT '',valid_until date NOT NULL,FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id));
CREATE TABLE stock_balances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),material_id uuid NOT NULL,warehouse_id uuid NOT NULL,quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK(quantity>=0),reserved numeric(18,6) NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=quantity),UNIQUE(tenant_id,material_id,warehouse_id),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),FOREIGN KEY(tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id));
CREATE TABLE reservations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),order_id uuid NOT NULL,material_id uuid NOT NULL,warehouse_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),status text NOT NULL DEFAULT 'held' CHECK(status IN('held','released','consumed')),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id),FOREIGN KEY(tenant_id,warehouse_id) REFERENCES warehouses(tenant_id,id));
CREATE TABLE material_requirements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),order_id uuid NOT NULL,material_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),source text NOT NULL DEFAULT 'undecided' CHECK(source IN('undecided','own','customer','customer_supplier')),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,material_id) REFERENCES materials(tenant_id,id));
CREATE TABLE stations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,capacity numeric(18,6) NOT NULL DEFAULT 1 CHECK(capacity>0),UNIQUE(tenant_id,id));
CREATE TABLE work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),order_id uuid NOT NULL,station_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),completed numeric(18,6) NOT NULL DEFAULT 0 CHECK(completed>=0 AND completed<=quantity),scrap numeric(18,6) NOT NULL DEFAULT 0 CHECK(scrap>=0 AND completed+scrap<=quantity),status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','paused','done','cancelled')),assigned_to text,version integer NOT NULL DEFAULT 1,UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,station_id) REFERENCES stations(tenant_id,id));
CREATE TABLE quality_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),work_order_id uuid NOT NULL,result text NOT NULL CHECK(result IN('pass','fail','hold')),sample_size numeric(18,6) NOT NULL CHECK(sample_size>0),note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,work_order_id) REFERENCES work_orders(tenant_id,id));
CREATE TABLE employees(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,code text NOT NULL,job_title text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,UNIQUE(tenant_id,code),UNIQUE(tenant_id,id));
CREATE TABLE shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),employee_id uuid NOT NULL,station_id uuid,start_at timestamptz NOT NULL,end_at timestamptz NOT NULL CHECK(end_at>start_at),note text NOT NULL DEFAULT '',FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),FOREIGN KEY(tenant_id,station_id) REFERENCES stations(tenant_id,id));
CREATE TABLE attendance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),employee_id uuid NOT NULL,arrived_at timestamptz NOT NULL,left_at timestamptz CHECK(left_at>=arrived_at),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id));
CREATE TABLE customer_access(tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL,partner_id uuid NOT NULL,PRIMARY KEY(tenant_id,user_id),FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id));
CREATE TABLE customer_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),partner_id uuid NOT NULL,order_id uuid,subject text NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN('open','investigating','resolved')),satisfaction integer CHECK(satisfaction BETWEEN 1 AND 5),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id));
CREATE TABLE import_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),created_by text NOT NULL,file_name text NOT NULL,sha256 text NOT NULL,rows jsonb NOT NULL,mapping jsonb NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'preview' CHECK(status IN('preview','confirmed','rejected')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id));
CREATE TABLE import_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),partner_id uuid,name text NOT NULL,mapping jsonb NOT NULL,FOREIGN KEY(tenant_id,partner_id) REFERENCES partners(tenant_id,id));
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),recipient text NOT NULL,title text NOT NULL,body text NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notification_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),event text NOT NULL CHECK(event IN('low_stock','purchase_pending','order_due')),channel text NOT NULL CHECK(channel IN('email','in_app')),recipient text NOT NULL,enabled boolean NOT NULL DEFAULT true);
CREATE TABLE outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants(id),kind text NOT NULL,payload jsonb NOT NULL,attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),processed_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE consent_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL,document text NOT NULL,version text NOT NULL,accepted boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE privacy_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id text NOT NULL,kind text NOT NULL CHECK(kind IN('export','erase','correct')),message text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','completed','rejected')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE integration_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),provider text NOT NULL,enabled boolean NOT NULL DEFAULT false,configuration jsonb NOT NULL DEFAULT '{}',UNIQUE(tenant_id,provider));
CREATE TABLE approval_proposals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),source text NOT NULL CHECK(source IN('ai','voice','whatsapp')),action text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE webhook_events(provider text NOT NULL,event_id text NOT NULL,payload_hash text NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(provider,event_id));
CREATE TABLE public_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,name text NOT NULL,email text NOT NULL,company text NOT NULL,message text NOT NULL,consent_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE fx_rates(day date PRIMARY KEY,usd_try numeric(18,6) NOT NULL CHECK(usd_try>0),source text NOT NULL);

DO $$ DECLARE tbl text; perm text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['tenant_roles','tenant_settings','units','partner_codes','supplier_quotes','stock_balances','reservations','material_requirements','stations','work_orders','quality_checks','employees','shifts','attendance','customer_cases','import_jobs','import_templates','notifications','notification_rules','consent_records','privacy_requests','integration_settings','approval_proposals','subscriptions'] LOOP
  perm:=CASE WHEN tbl IN('tenant_roles','tenant_settings','integration_settings','notification_rules') THEN 'settings' WHEN tbl IN('supplier_quotes','approval_proposals') THEN 'purchasing' WHEN tbl IN('stock_balances','reservations') THEN 'stock' WHEN tbl IN('material_requirements','customer_cases','import_jobs','import_templates') THEN 'orders' WHEN tbl IN('stations','work_orders','quality_checks') THEN 'production' WHEN tbl IN('employees','shifts','attendance') THEN 'hr' WHEN tbl='subscriptions' THEN 'billing' WHEN tbl IN('notifications','consent_records','privacy_requests') THEN 'profile' ELSE 'catalog' END;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT TO olaph_runtime USING (tenant_id::text=current_setting(''app.tenant_id'',true) AND has_permission(%L))',tbl,perm||':read');
  IF tbl NOT IN('stock_balances','reservations','subscriptions','tenant_roles') THEN
   EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO olaph_runtime WITH CHECK(tenant_id::text=current_setting(''app.tenant_id'',true) AND has_permission(%L))',tbl,perm||':write');
   EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO olaph_runtime USING(tenant_id::text=current_setting(''app.tenant_id'',true) AND has_permission(%L)) WITH CHECK(tenant_id::text=current_setting(''app.tenant_id'',true) AND has_permission(%L))',tbl,perm||':write',perm||':write');
   EXECUTE format('GRANT INSERT,UPDATE ON %I TO olaph_runtime',tbl);
  END IF;
  EXECUTE format('GRANT SELECT ON %I TO olaph_runtime',tbl);
  EXECUTE format('CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_change()',tbl);
  EXECUTE format('CREATE INDEX ON %I(tenant_id)',tbl);
 END LOOP;
END $$;
-- Sensitive values require the financial permission at the database boundary.
DROP POLICY tenant_read ON supplier_quotes;
CREATE POLICY tenant_read ON supplier_quotes FOR SELECT TO olaph_runtime USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('purchasing:read') AND has_permission('cost:read'));
DROP POLICY tenant_read ON purchase_requests;
CREATE POLICY tenant_read ON purchase_requests FOR SELECT TO olaph_runtime USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('purchasing:read') AND has_permission('cost:read'));
REVOKE UPDATE ON purchase_requests FROM olaph_runtime;
REVOKE UPDATE ON materials FROM olaph_runtime;
GRANT UPDATE(code,name,unit,minimum,custom_fields) ON materials TO olaph_runtime;
-- A request can never grant itself approval during insertion.
ALTER TABLE purchase_requests ADD COLUMN requested_by text NOT NULL DEFAULT current_setting('app.user_id',true);
ALTER TABLE purchase_requests ADD COLUMN approved_at timestamptz;
DROP POLICY tenant_insert ON purchase_requests;
CREATE POLICY tenant_insert ON purchase_requests FOR INSERT TO olaph_runtime WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('purchasing:write') AND status='pending' AND approved_by IS NULL AND approved_at IS NULL AND requested_by=current_setting('app.user_id',true));

CREATE FUNCTION apply_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE balance numeric; held numeric;
BEGIN
 IF NEW.tenant_id::text IS DISTINCT FROM current_setting('app.tenant_id',true) OR NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=NEW.tenant_id AND user_id=current_setting('app.user_id',true) AND active AND 'stock:write'=ANY(permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NEW.warehouse_id IS NULL THEN RAISE EXCEPTION 'WAREHOUSE_REQUIRED'; END IF;
 PERFORM 1 FROM materials WHERE tenant_id=NEW.tenant_id AND id=NEW.material_id FOR UPDATE;
 INSERT INTO stock_balances(tenant_id,material_id,warehouse_id) VALUES(NEW.tenant_id,NEW.material_id,NEW.warehouse_id) ON CONFLICT DO NOTHING;
 SELECT quantity,reserved INTO balance,held FROM stock_balances WHERE tenant_id=NEW.tenant_id AND material_id=NEW.material_id AND warehouse_id=NEW.warehouse_id FOR UPDATE;
 IF balance+NEW.quantity<held THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;
 UPDATE stock_balances SET quantity=quantity+NEW.quantity WHERE tenant_id=NEW.tenant_id AND material_id=NEW.material_id AND warehouse_id=NEW.warehouse_id;
 UPDATE materials SET quantity=quantity+NEW.quantity WHERE tenant_id=NEW.tenant_id AND id=NEW.material_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION apply_stock_movement() FROM PUBLIC;
CREATE TRIGGER balance_stock AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

CREATE FUNCTION reserve_stock(p_order uuid,p_material uuid,p_warehouse uuid,p_quantity numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; rid uuid; b stock_balances;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active AND 'stock:write'=ANY(permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_quantity<=0 THEN RAISE EXCEPTION 'POSITIVE_QUANTITY_REQUIRED'; END IF;
 SELECT * INTO b FROM stock_balances WHERE tenant_id=tid AND material_id=p_material AND warehouse_id=p_warehouse FOR UPDATE;
 IF b.id IS NULL OR b.quantity-b.reserved<p_quantity THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;
 UPDATE stock_balances SET reserved=reserved+p_quantity WHERE id=b.id;
 INSERT INTO reservations(tenant_id,order_id,material_id,warehouse_id,quantity) VALUES(tid,p_order,p_material,p_warehouse,p_quantity) RETURNING id INTO rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION reserve_stock(uuid,uuid,uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_stock(uuid,uuid,uuid,numeric) TO olaph_runtime;

CREATE FUNCTION decide_purchase(p_id uuid,p_decision text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active AND 'purchasing:approve'=ANY(permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_decision NOT IN('approved','rejected') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 UPDATE purchase_requests SET status=p_decision,approved_by=current_setting('app.user_id',true),approved_at=now() WHERE tenant_id=tid AND id=p_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING'; END IF;
END $$;
REVOKE ALL ON FUNCTION decide_purchase(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_purchase(uuid,text) TO olaph_runtime;
