import {
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { transaction, authPool, type Database } from "./db.js";
import { id, resources } from "./resources.js";
export async function identity(req: Request) {
  const result = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!result?.user.emailVerified)
    throw new UnauthorizedException("SIGN_IN_REQUIRED");
  return result;
}
export async function access(
  req: Request,
  tenant: string,
  permission?: string,
  critical = false,
) {
  id.parse(tenant);
  const current = await identity(req);
  const workspace = await transaction(
    current.user.id,
    null,
    async (db) =>
      (
        await db.query("SELECT * FROM workspace_summaries() WHERE id=$1", [
          tenant,
        ])
      ).rows[0],
  );
  if (!workspace || (permission && !workspace.permissions.includes(permission)))
    throw new ForbiddenException("PERMISSION_DENIED");
  if (workspace.mfa_required && !current.user.twoFactorEnabled)
    throw new HttpException("MFA_SETUP_REQUIRED", 423);
  if (
    critical &&
    !(
      await authPool.query(
        "SELECT 1 FROM app_reauth WHERE session_id=$1 AND user_id=$2 AND expires_at>now()",
        [current.session.id, current.user.id],
      )
    ).rowCount
  )
    throw new HttpException("REAUTHENTICATION_REQUIRED", 428);
  return current;
}
export function resource(name: string) {
  const item = resources[name];
  if (!item) throw new NotFoundException("RESOURCE_NOT_FOUND");
  return item;
}
export async function entitlement(db: Database) {
  if (
    !(await db.query("SELECT workspace_can_write() allowed")).rows[0]?.allowed
  )
    throw new HttpException("SUBSCRIPTION_REQUIRED", 402);
}
