CREATE FUNCTION workspace_can_write() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM subscriptions s JOIN memberships m ON m.tenant_id=s.tenant_id WHERE s.tenant_id::text=current_setting('app.tenant_id',true) AND m.user_id=current_setting('app.user_id',true) AND m.active AND ((s.status='trialing' AND s.trial_ends_at>now()) OR (s.status='active' AND s.period_ends_at>now())))
$$;
REVOKE ALL ON FUNCTION workspace_can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workspace_can_write() TO olaph_runtime;
