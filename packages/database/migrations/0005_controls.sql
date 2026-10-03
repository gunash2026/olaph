REVOKE INSERT ON materials FROM olaph_runtime;
GRANT INSERT(tenant_id,code,name,unit,minimum,custom_fields) ON materials TO olaph_runtime;
DROP POLICY tenant_audit ON audit_log;
CREATE POLICY tenant_audit ON audit_log FOR SELECT TO olaph_runtime USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('audit:read') AND (entity NOT IN('purchase_requests','supplier_quotes') OR has_permission('cost:read')) AND (entity NOT IN('employees','shifts','attendance') OR has_permission('hr:read')));
DROP POLICY tenant_read ON privacy_requests;
CREATE POLICY tenant_read ON privacy_requests FOR SELECT TO olaph_runtime USING(tenant_id::text=current_setting('app.tenant_id',true) AND user_id=current_setting('app.user_id',true) AND has_permission('profile:read'));
DROP POLICY tenant_insert ON privacy_requests;
CREATE POLICY tenant_insert ON privacy_requests FOR INSERT TO olaph_runtime WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true) AND user_id=current_setting('app.user_id',true) AND has_permission('profile:write') AND status='pending');
REVOKE UPDATE ON privacy_requests,consent_records FROM olaph_runtime;
DROP POLICY tenant_read ON notifications;
CREATE POLICY tenant_read ON notifications FOR SELECT TO olaph_runtime USING(tenant_id::text=current_setting('app.tenant_id',true) AND recipient=current_setting('app.user_email',true) AND has_permission('profile:read'));
REVOKE INSERT,UPDATE ON notifications FROM olaph_runtime;
CREATE FUNCTION reservation_ownership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid; customer_id uuid; order_status text;
BEGIN
 SELECT owner_partner_id INTO owner_id FROM warehouses WHERE tenant_id=NEW.tenant_id AND id=NEW.warehouse_id;
 SELECT partner_id,status INTO customer_id,order_status FROM orders WHERE tenant_id=NEW.tenant_id AND id=NEW.order_id;
 IF order_status IS NULL OR order_status NOT IN('draft','active') THEN RAISE EXCEPTION 'ORDER_NOT_ACTIVE'; END IF;
 IF owner_id IS NOT NULL AND owner_id IS DISTINCT FROM customer_id THEN RAISE EXCEPTION 'STOCK_OWNER_MISMATCH'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION reservation_ownership() FROM PUBLIC;
CREATE TRIGGER check_reservation_owner BEFORE INSERT ON reservations FOR EACH ROW EXECUTE FUNCTION reservation_ownership();
CREATE FUNCTION finish_reservation(p_id uuid,p_action text,p_key uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; r reservations;
BEGIN
 IF p_action NOT IN('released','consumed') OR NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active AND 'stock:write'=ANY(permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO r FROM reservations WHERE tenant_id=tid AND id=p_id;
 IF r.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_FOUND'; END IF;
 PERFORM 1 FROM materials WHERE tenant_id=tid AND id=r.material_id FOR UPDATE;
 SELECT * INTO r FROM reservations WHERE tenant_id=tid AND id=p_id FOR UPDATE;
 IF r.status<>'held' THEN RETURN r.status; END IF;
 UPDATE stock_balances SET reserved=reserved-r.quantity WHERE tenant_id=tid AND material_id=r.material_id AND warehouse_id=r.warehouse_id;
 IF p_action='consumed' THEN INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,note,idempotency_key) VALUES(tid,r.material_id,r.warehouse_id,-r.quantity,'Reservation consumed',p_key); END IF;
 UPDATE reservations SET status=p_action WHERE id=p_id AND tenant_id=tid;
 RETURN p_action;
END $$;
REVOKE ALL ON FUNCTION finish_reservation(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_reservation(uuid,text,uuid) TO olaph_runtime;
CREATE FUNCTION notify_business_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rule notification_rules; event_name text; title_text text; body_text text;
BEGIN
 IF TG_TABLE_NAME='materials' THEN
  IF NEW.quantity>NEW.minimum OR (TG_OP='UPDATE' AND OLD.quantity<=OLD.minimum) THEN RETURN NEW; END IF;
  event_name:='low_stock';title_text:='Kritik stok';body_text:=NEW.code||' · '||NEW.name||' · '||NEW.quantity::text||' '||NEW.unit;
 ELSE event_name:='purchase_pending';title_text:='Satın alma onayı bekleniyor';body_text:=NEW.id::text; END IF;
 FOR rule IN SELECT * FROM notification_rules WHERE tenant_id=NEW.tenant_id AND event=event_name AND enabled LOOP
  IF rule.channel='in_app' THEN INSERT INTO notifications(tenant_id,recipient,title,body) VALUES(NEW.tenant_id,rule.recipient,title_text,body_text);
  ELSE INSERT INTO outbox(tenant_id,kind,payload) VALUES(NEW.tenant_id,'email',jsonb_build_object('to',rule.recipient,'subject',title_text,'text',body_text)); END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION notify_business_event() FROM PUBLIC;
CREATE TRIGGER notify_low_stock AFTER UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION notify_business_event();
CREATE TRIGGER notify_purchase AFTER INSERT ON purchase_requests FOR EACH ROW EXECUTE FUNCTION notify_business_event();
CREATE ROLE olaph_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO olaph_worker;
GRANT SELECT,UPDATE ON outbox TO olaph_worker;
