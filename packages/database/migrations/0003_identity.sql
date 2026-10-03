CREATE FUNCTION create_workspace(p_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid text:=NULLIF(current_setting('app.user_id',true),''); tid uuid; rid uuid; all_permissions text[]:=ARRAY['catalog:read','catalog:write','stock:read','stock:write','orders:read','orders:write','purchasing:read','purchasing:write','purchasing:approve','cost:read','settings:read','settings:write','audit:read','production:read','production:write','hr:read','hr:write','billing:read','billing:write','profile:read','profile:write','reports:read'];
BEGIN
 IF uid IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'INVALID_WORKSPACE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid,1));
 IF (SELECT count(*) FROM memberships WHERE user_id=uid AND role='admin')>=3 THEN RAISE EXCEPTION 'WORKSPACE_LIMIT'; END IF;
 INSERT INTO tenants(name) VALUES(trim(p_name)) RETURNING id INTO tid;
 INSERT INTO tenant_roles(tenant_id,name,permissions,mfa_required) VALUES(tid,'admin',all_permissions,true) RETURNING id INTO rid;
 INSERT INTO memberships(tenant_id,user_id,role,role_id,permissions) VALUES(tid,uid,'admin',rid,all_permissions);
 INSERT INTO tenant_roles(tenant_id,name,permissions,mfa_required) VALUES(tid,'manager',array_remove(array_remove(all_permissions,'settings:write'),'hr:write'),true),(tid,'accountant',ARRAY['catalog:read','stock:read','orders:read','purchasing:read','purchasing:write','cost:read','billing:read','reports:read','profile:read','profile:write'],false),(tid,'production',ARRAY['catalog:read','stock:read','stock:write','orders:read','production:read','production:write','profile:read','profile:write'],false);
 INSERT INTO tenant_settings(tenant_id) VALUES(tid);
 INSERT INTO subscriptions(tenant_id) VALUES(tid);
 INSERT INTO audit_log(tenant_id,actor_id,entity,entity_id,action,new_value) VALUES(tid,uid,'tenants',tid,'INSERT',jsonb_build_object('name',p_name));
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION create_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace(text) TO olaph_runtime;

CREATE FUNCTION workspace_members() RETURNS TABLE(user_id text,role text,role_id uuid,active boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=tid AND m.user_id=current_setting('app.user_id',true) AND m.active AND 'settings:read'=ANY(m.permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN QUERY SELECT m.user_id,m.role,m.role_id,m.active FROM memberships m WHERE m.tenant_id=tid;
END $$;
REVOKE ALL ON FUNCTION workspace_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workspace_members() TO olaph_runtime;

CREATE FUNCTION save_role(p_id uuid,p_name text,p_permissions text[],p_mfa boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; actor memberships; rid uuid;
BEGIN
 SELECT * INTO actor FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active;
 IF actor.user_id IS NULL OR NOT 'settings:write'=ANY(actor.permissions) OR NOT p_permissions<@actor.permissions THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_name='admin' OR EXISTS(SELECT 1 FROM tenant_roles WHERE tenant_id=tid AND id=p_id AND name='admin') THEN RAISE EXCEPTION 'ADMIN_ROLE_PROTECTED'; END IF;
 IF (p_permissions&&ARRAY['settings:write','purchasing:approve']) AND NOT p_mfa THEN RAISE EXCEPTION 'MFA_REQUIRED_FOR_PRIVILEGED_ROLE'; END IF;
 INSERT INTO tenant_roles(id,tenant_id,name,permissions,mfa_required) VALUES(COALESCE(p_id,gen_random_uuid()),tid,p_name,p_permissions,p_mfa) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,permissions=EXCLUDED.permissions,mfa_required=EXCLUDED.mfa_required WHERE tenant_roles.tenant_id=tid RETURNING id INTO rid;
 IF rid IS NULL THEN RAISE EXCEPTION 'ROLE_NOT_FOUND'; END IF;
 UPDATE memberships SET role=p_name,permissions=p_permissions WHERE tenant_id=tid AND role_id=rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION save_role(uuid,text,text[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_role(uuid,text,text[],boolean) TO olaph_runtime;

CREATE FUNCTION invite_member(p_email text,p_role uuid,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; rid uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active AND 'settings:write'=ANY(permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tenant_roles WHERE tenant_id=tid AND id=p_role AND name<>'admin') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
 INSERT INTO invitations(tenant_id,email,role_id,token_hash,expires_at,invited_by) VALUES(tid,lower(p_email),p_role,p_hash,now()+interval '48 hours',current_setting('app.user_id',true)) RETURNING id INTO rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION invite_member(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_member(text,uuid,text) TO olaph_runtime;

CREATE FUNCTION accept_invitation(p_hash text,p_verified_email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invite invitations; role_row tenant_roles; sub subscriptions; seat_limit integer; uid text:=NULLIF(current_setting('app.user_id',true),'');
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO invite FROM invitations WHERE token_hash=p_hash AND email=lower(p_verified_email) AND accepted_at IS NULL AND expires_at>now() FOR UPDATE;
 IF invite.id IS NULL THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
 SELECT * INTO sub FROM subscriptions WHERE tenant_id=invite.tenant_id FOR UPDATE;
 seat_limit:=CASE sub.plan WHEN 'starter' THEN 5 WHEN 'professional' THEN 15 ELSE 2147483647 END + sub.extra_seats;
 IF (SELECT count(*) FROM memberships WHERE tenant_id=invite.tenant_id AND active)>=seat_limit THEN RAISE EXCEPTION 'SEAT_LIMIT'; END IF;
 SELECT * INTO role_row FROM tenant_roles WHERE id=invite.role_id AND tenant_id=invite.tenant_id;
 INSERT INTO memberships(tenant_id,user_id,role,role_id,permissions) VALUES(invite.tenant_id,uid,role_row.name,role_row.id,role_row.permissions) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=EXCLUDED.role,role_id=EXCLUDED.role_id,permissions=EXCLUDED.permissions,active=true;
 UPDATE invitations SET accepted_at=now() WHERE id=invite.id;
 INSERT INTO audit_log(tenant_id,actor_id,entity,entity_id,action,new_value) VALUES(invite.tenant_id,uid,'invitations',invite.id,'ACCEPT',jsonb_build_object('role',role_row.name));
 RETURN invite.tenant_id;
END $$;
REVOKE ALL ON FUNCTION accept_invitation(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_invitation(text,text) TO olaph_runtime;

CREATE FUNCTION set_member(p_user text,p_role uuid,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; chosen tenant_roles;
BEGIN
 IF p_user=current_setting('app.user_id',true) OR NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active AND 'settings:write'=ANY(permissions)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO chosen FROM tenant_roles WHERE tenant_id=tid AND id=p_role;
 IF chosen.id IS NULL OR chosen.name='admin' OR EXISTS(SELECT 1 FROM memberships WHERE tenant_id=tid AND user_id=p_user AND role='admin') THEN RAISE EXCEPTION 'ADMIN_ROLE_PROTECTED'; END IF;
 UPDATE memberships SET role_id=chosen.id,role=chosen.name,permissions=chosen.permissions,active=p_active WHERE tenant_id=tid AND user_id=p_user;
 INSERT INTO audit_log(tenant_id,actor_id,entity,entity_id,action,new_value) VALUES(tid,current_setting('app.user_id',true),'memberships',tid,'UPDATE',jsonb_build_object('user',p_user,'role',chosen.name,'active',p_active));
END $$;
REVOKE ALL ON FUNCTION set_member(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_member(text,uuid,boolean) TO olaph_runtime;

CREATE FUNCTION workspace_summaries() RETURNS TABLE(id uuid,name text,role text,permissions text[],mfa_required boolean) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT t.id,t.name,m.role,m.permissions,COALESCE(r.mfa_required,m.role IN('admin','manager')) FROM tenants t JOIN memberships m ON m.tenant_id=t.id LEFT JOIN tenant_roles r ON r.id=m.role_id AND r.tenant_id=t.id WHERE m.user_id=current_setting('app.user_id',true) AND m.active
$$;
REVOKE ALL ON FUNCTION workspace_summaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workspace_summaries() TO olaph_runtime;
