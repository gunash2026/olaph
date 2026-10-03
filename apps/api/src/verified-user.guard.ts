import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { identity } from "./security.js";
@Injectable()
export class VerifiedUserGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    await identity(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
