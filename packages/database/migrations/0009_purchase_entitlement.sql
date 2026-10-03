CREATE OR REPLACE FUNCTION decide_purchase(p_id uuid,p_decision text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid;
BEGIN
 IF NOT has_permission('purchasing:approve') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT workspace_can_write() THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
 IF p_decision NOT IN('approved','rejected') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 UPDATE purchase_requests SET status=p_decision,approved_by=current_setting('app.user_id',true),approved_at=now() WHERE tenant_id=tid AND id=p_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING'; END IF;
END $$;
