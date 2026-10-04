CREATE OR REPLACE FUNCTION invite_member(p_email text,p_role uuid,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; actor memberships; chosen tenant_roles; rid uuid;
BEGIN
 SELECT * INTO actor FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active;
 SELECT * INTO chosen FROM tenant_roles WHERE tenant_id=tid AND id=p_role;
 IF actor.user_id IS NULL OR NOT 'settings:write'=ANY(actor.permissions) OR chosen.id IS NULL OR NOT chosen.permissions<@actor.permissions THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF chosen.name='admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_PROTECTED'; END IF;
 INSERT INTO invitations(tenant_id,email,role_id,token_hash,expires_at,invited_by) VALUES(tid,lower(trim(p_email)),p_role,p_hash,now()+interval '48 hours',actor.user_id) RETURNING id INTO rid;
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION accept_invitation(p_hash text,p_verified_email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invite invitations; chosen tenant_roles; sub subscriptions; existing memberships; seat_limit bigint; uid text:=NULLIF(current_setting('app.user_id',true),'');
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO invite FROM invitations WHERE token_hash=p_hash AND email=lower(trim(p_verified_email)) AND accepted_at IS NULL AND expires_at>now() FOR UPDATE;
 IF invite.id IS NULL THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
 SELECT * INTO chosen FROM tenant_roles WHERE id=invite.role_id AND tenant_id=invite.tenant_id;
 IF chosen.id IS NULL OR chosen.name='admin' OR NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=invite.tenant_id AND user_id=invite.invited_by AND active AND 'settings:write'=ANY(permissions) AND chosen.permissions<@permissions) THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
 SELECT * INTO sub FROM subscriptions WHERE tenant_id=invite.tenant_id FOR UPDATE;
 SELECT * INTO existing FROM memberships WHERE tenant_id=invite.tenant_id AND user_id=uid FOR UPDATE;
 IF existing.role='admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_PROTECTED'; END IF;
 seat_limit:=CASE sub.plan WHEN 'starter' THEN 5::bigint WHEN 'professional' THEN 15::bigint ELSE 2147483647::bigint END + sub.extra_seats;
 IF NOT COALESCE(existing.active,false) AND (SELECT count(*) FROM memberships WHERE tenant_id=invite.tenant_id AND active)>=seat_limit THEN RAISE EXCEPTION 'SEAT_LIMIT'; END IF;
 INSERT INTO memberships(tenant_id,user_id,role,role_id,permissions) VALUES(invite.tenant_id,uid,chosen.name,chosen.id,chosen.permissions) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=EXCLUDED.role,role_id=EXCLUDED.role_id,permissions=EXCLUDED.permissions,active=true;
 UPDATE invitations SET accepted_at=now() WHERE id=invite.id;
 INSERT INTO audit_log(tenant_id,actor_id,entity,entity_id,action,new_value) VALUES(invite.tenant_id,uid,'invitations',invite.id,'ACCEPT',jsonb_build_object('role',chosen.name));
 RETURN invite.tenant_id;
END $$;

CREATE OR REPLACE FUNCTION set_member(p_user text,p_role uuid,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tid uuid:=current_setting('app.tenant_id',true)::uuid; actor memberships; chosen tenant_roles; existing memberships; sub subscriptions; seat_limit bigint;
BEGIN
 SELECT * INTO actor FROM memberships WHERE tenant_id=tid AND user_id=current_setting('app.user_id',true) AND active;
 SELECT * INTO chosen FROM tenant_roles WHERE tenant_id=tid AND id=p_role;
 IF p_user=actor.user_id OR actor.user_id IS NULL OR NOT 'settings:write'=ANY(actor.permissions) OR chosen.id IS NULL OR NOT chosen.permissions<@actor.permissions THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO sub FROM subscriptions WHERE tenant_id=tid FOR UPDATE;
 SELECT * INTO existing FROM memberships WHERE tenant_id=tid AND user_id=p_user FOR UPDATE;
 IF existing.user_id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
 IF chosen.name='admin' OR existing.role='admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_PROTECTED'; END IF;
 seat_limit:=CASE sub.plan WHEN 'starter' THEN 5::bigint WHEN 'professional' THEN 15::bigint ELSE 2147483647::bigint END + sub.extra_seats;
 IF p_active AND NOT existing.active AND (SELECT count(*) FROM memberships WHERE tenant_id=tid AND active)>=seat_limit THEN RAISE EXCEPTION 'SEAT_LIMIT'; END IF;
 UPDATE memberships SET role_id=chosen.id,role=chosen.name,permissions=chosen.permissions,active=p_active WHERE tenant_id=tid AND user_id=p_user;
 INSERT INTO audit_log(tenant_id,actor_id,entity,entity_id,action,old_value,new_value) VALUES(tid,actor.user_id,'memberships',tid,'UPDATE',jsonb_build_object('user',p_user,'role',existing.role,'active',existing.active),jsonb_build_object('user',p_user,'role',chosen.name,'active',p_active));
END $$;
