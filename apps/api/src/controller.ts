import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { verifyRecentIdentity } from "./reauthentication.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { pool, authPool, transaction } from "./db.js";
import { id, positive, quantity } from "./resources.js";
import { config } from "./config.js";
import { sendMail } from "./mail.js";
import { digest, workbookExport } from "./excel.js";
import { identity, access, resource, entitlement } from "./security.js";
const needsSql = `WITH RECURSIVE tree(order_id,product_id,factor,path,depth) AS (
 SELECT l.order_id,l.product_id,l.quantity,ARRAY[l.product_id],0 FROM order_lines l JOIN orders o ON o.id=l.order_id AND o.tenant_id=l.tenant_id WHERE o.status IN('draft','active') AND NOT EXISTS(SELECT 1 FROM material_requirements m WHERE m.order_id=l.order_id)
 UNION ALL SELECT t.order_id,r.component_product_id,t.factor*r.quantity,t.path||r.component_product_id,t.depth+1 FROM tree t JOIN recipes r ON r.product_id=t.product_id WHERE r.component_product_id IS NOT NULL AND NOT r.component_product_id=ANY(t.path) AND t.depth<30
), amounts AS (SELECT r.material_id,sum(t.factor*r.quantity) quantity FROM tree t JOIN recipes r ON r.product_id=t.product_id WHERE r.material_id IS NOT NULL GROUP BY r.material_id UNION ALL SELECT m.material_id,sum(m.quantity) FROM material_requirements m JOIN orders o ON o.id=m.order_id WHERE o.status IN('draft','active') GROUP BY m.material_id), totals AS(SELECT material_id,sum(quantity) required FROM amounts GROUP BY material_id), available AS(SELECT b.material_id,sum(b.quantity-b.reserved) available FROM stock_balances b JOIN warehouses w ON w.id=b.warehouse_id WHERE w.owner_partner_id IS NULL GROUP BY b.material_id) SELECT m.id,m.code,m.name,m.unit,t.required::text,COALESCE(a.available,0)::text available,GREATEST(t.required-COALESCE(a.available,0),0)::text shortage FROM totals t JOIN materials m ON m.id=t.material_id LEFT JOIN available a ON a.material_id=m.id ORDER BY m.code`;
@Controller("api")
export class ApiController {
  @Get("session") async session(@Req() req: Request) {
    const current = await identity(req);
    return {
      user: current.user,
      workspaces: await transaction(
        current.user.id,
        null,
        async (db) =>
          (await db.query("SELECT * FROM workspace_summaries()")).rows,
      ),
    };
  }
  @Post("workspaces") async create(@Req() req: Request, @Body() body: unknown) {
    const current = await identity(req),
      input = z
        .object({ name: z.string().trim().min(2).max(120) })
        .strict()
        .parse(body);
    return transaction(
      current.user.id,
      null,
      async (db) =>
        (await db.query("SELECT create_workspace($1) id", [input.name]))
          .rows[0],
    );
  }
  @Post("invitations/accept") async accept(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const current = await identity(req),
      { token } = z.object({ token: z.string().min(40).max(128) }).parse(body);
    return transaction(
      current.user.id,
      null,
      async (db) =>
        (
          await db.query("SELECT accept_invitation($1,$2) id", [
            digest(token),
            current.user.email,
          ])
        ).rows[0],
    );
  }
  @Post("reauthenticate") async reauthenticate(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const current = await identity(req),
      data = z
        .object({
          password: z.string().min(1).max(128),
          code: z.string().regex(/^\d{6}$/),
        })
        .strict()
        .parse(body);
    if (!current.user.twoFactorEnabled)
      throw new ForbiddenException("MFA_SETUP_REQUIRED");
    await verifyRecentIdentity(
      req,
      current.user.id,
      current.session.id,
      data.password,
      data.code,
    );
    return { expiresIn: 300 };
  }
  @Get("workspaces/:tenant/resources/:name") async list(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("name") name: string,
    @Query("page") page?: string,
  ) {
    const item = resource(name),
      current = await access(req, tenant, `${item.permission}:read`),
      offset =
        z.coerce.number().int().min(0).max(100000).default(0).parse(page) * 100;
    if (["quotes", "purchases"].includes(name))
      await access(req, tenant, "cost:read");
    return transaction(current.user.id, tenant, async (db) => ({
      items: (
        await db.query(
          `SELECT * FROM ${item.table} ${name === "notifications" ? "WHERE recipient=$2" : ""} ORDER BY id LIMIT 100 OFFSET $1`,
          name === "notifications" ? [offset, current.user.email] : [offset],
        )
      ).rows,
      page: offset / 100,
    }));
  }
  @Post("workspaces/:tenant/resources/:name") async insert(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("name") name: string,
    @Body() body: unknown,
  ) {
    const item = resource(name);
    if (item.readonly) throw new ForbiddenException("READ_ONLY");
    const current = await access(req, tenant, `${item.permission}:write`),
      input: Record<string, unknown> = item.schema.strict().parse(body);
    if (name === "privacy-requests") input.user_id = current.user.id;
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      const keys = Object.keys(input);
      return (
        await db.query(
          `INSERT INTO ${item.table}(tenant_id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => `$${i + 2}`).join(",")}) RETURNING *`,
          [tenant, ...keys.map((key) => input[key])],
        )
      ).rows[0];
    });
  }
  @Patch("workspaces/:tenant/resources/:name/:record") async update(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("name") name: string,
    @Param("record") record: string,
    @Body() body: unknown,
  ) {
    const item = resource(name);
    if (item.readonly || item.immutable)
      throw new ForbiddenException("WORKFLOW_REQUIRED");
    const current = await access(req, tenant, `${item.permission}:write`),
      input: Record<string, unknown> = item.schema.strict().parse(body);
    id.parse(record);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      const keys = Object.keys(input),
        row = (
          await db.query(
            `UPDATE ${item.table} SET ${keys.map((key, i) => `${key}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING *`,
            [record, ...keys.map((key) => input[key])],
          )
        ).rows[0];
      if (!row) throw new NotFoundException();
      return row;
    });
  }
  @Post("workspaces/:tenant/movements") async movement(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "stock:write"),
      data = z
        .object({
          material_id: id,
          warehouse_id: id,
          direction: z.enum(["in", "out"]),
          quantity: positive,
          note: z.string().max(300).default(""),
          idempotency_key: id,
        })
        .strict()
        .parse(body);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      const existing = (
          await db.query(
            "SELECT * FROM stock_movements WHERE idempotency_key=$1",
            [data.idempotency_key],
          )
        ).rows[0],
        signed = data.direction === "out" ? `-${data.quantity}` : data.quantity;
      if (existing) {
        if (
          existing.material_id !== data.material_id ||
          existing.warehouse_id !== data.warehouse_id ||
          !new Decimal(existing.quantity).eq(signed)
        )
          throw new HttpException("IDEMPOTENCY_CONFLICT", 409);
        return existing;
      }
      const inserted = await db.query(
        "INSERT INTO stock_movements(tenant_id,material_id,warehouse_id,quantity,note,idempotency_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING RETURNING *",
        [
          tenant,
          data.material_id,
          data.warehouse_id,
          signed,
          data.note,
          data.idempotency_key,
        ],
      );
      if (!inserted.rowCount)
        throw new HttpException("REQUEST_IN_PROGRESS_RETRY", 409);
      return inserted.rows[0];
    });
  }
  @Post("workspaces/:tenant/stock-counts") async countStock(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "stock:write");
    const input = z
      .object({
        material_id: id,
        warehouse_id: id,
        expected_quantity: quantity,
        counted_quantity: quantity,
        reason: z.string().trim().min(3).max(300),
        idempotency_key: id,
      })
      .strict()
      .parse(body);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      return (
        await db.query("SELECT confirm_stock_count($1,$2,$3,$4,$5,$6) id", [
          input.material_id,
          input.warehouse_id,
          input.expected_quantity,
          input.counted_quantity,
          input.reason,
          input.idempotency_key,
        ])
      ).rows[0];
    });
  }
  @Post("workspaces/:tenant/reservations") async reserve(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "stock:write"),
      data = z
        .object({
          order_id: id,
          material_id: id,
          warehouse_id: id,
          quantity: positive,
        })
        .parse(body);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      return (
        await db.query("SELECT reserve_stock($1,$2,$3,$4) id", [
          data.order_id,
          data.material_id,
          data.warehouse_id,
          data.quantity,
        ])
      ).rows[0];
    });
  }
  @Post("workspaces/:tenant/purchases/:record/decision") async decision(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("record") record: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "purchasing:approve", true),
      data = z
        .object({ decision: z.enum(["approved", "rejected"]) })
        .parse(body);
    id.parse(record);
    return transaction(current.user.id, tenant, async (db) => {
      await db.query("SELECT decide_purchase($1,$2)", [record, data.decision]);
      return { status: data.decision };
    });
  }
  @Get("workspaces/:tenant/needs") async needs(
    @Req() req: Request,
    @Param("tenant") tenant: string,
  ) {
    const current = await access(req, tenant, "orders:read");
    await access(req, tenant, "stock:read");
    await access(req, tenant, "catalog:read");
    return transaction(current.user.id, tenant, async (db) => ({
      items: (await db.query(needsSql)).rows,
    }));
  }
  @Get("workspaces/:tenant/members") async members(
    @Req() req: Request,
    @Param("tenant") tenant: string,
  ) {
    const current = await access(req, tenant, "settings:read");
    return transaction(current.user.id, tenant, async (db) => ({
      items: (await db.query("SELECT * FROM workspace_members()")).rows,
    }));
  }
  @Post("workspaces/:tenant/settings") async settings(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "settings:write", true);
    const input = resource("settings").schema.strict().parse(body);
    return transaction(current.user.id, tenant, async (db) => {
      const row = (
        await db.query(
          "UPDATE tenant_settings SET locale=$1,timezone=$2,approval_limit=$3,retention_days=$4 WHERE tenant_id=$5 RETURNING *",
          [
            input.locale,
            input.timezone,
            input.approval_limit,
            input.retention_days,
            tenant,
          ],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      return row;
    });
  }
  @Post("workspaces/:tenant/reservations/:record/finish")
  async finishReservation(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("record") record: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "stock:write");
    const input = z
      .object({ action: z.enum(["released", "consumed"]), idempotency_key: id })
      .strict()
      .parse(body);
    id.parse(record);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      return (
        await db.query("SELECT finish_reservation($1,$2,$3) status", [
          record,
          input.action,
          input.idempotency_key,
        ])
      ).rows[0];
    });
  }
  @Post("workspaces/:tenant/invitations") async invite(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "settings:write", true),
      data = z.object({ email: z.email(), role_id: id }).strict().parse(body),
      token = randomBytes(32).toString("hex");
    await transaction(current.user.id, tenant, async (db) => {
      await db.query("SELECT invite_member($1,$2,$3)", [
        data.email,
        data.role_id,
        digest(token),
      ]);
    });
    await sendMail(
      data.email,
      "OLAPH · Çalışma alanı daveti",
      `${config.APP_URL}/tr/portal/?invite=${token}\nDavet 48 saat geçerlidir. Bu adresi doğrulayarak giriş yapmalısınız.`,
    );
    return { sent: true };
  }
  @Post("workspaces/:tenant/roles") async role(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "settings:write", true),
      data = z
        .object({
          id: id.nullable(),
          name: z.string().min(2).max(60),
          permissions: z.array(z.string().max(60)).max(50),
          mfa_required: z.boolean(),
        })
        .strict()
        .parse(body);
    return transaction(
      current.user.id,
      tenant,
      async (db) =>
        (
          await db.query("SELECT save_role($1,$2,$3,$4) id", [
            data.id,
            data.name,
            data.permissions,
            data.mfa_required,
          ])
        ).rows[0],
    );
  }
  @Post("workspaces/:tenant/members") async member(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "settings:write", true),
      data = z
        .object({
          user_id: z.string().min(1).max(128),
          role_id: id,
          active: z.boolean(),
        })
        .strict()
        .parse(body);
    return transaction(current.user.id, tenant, async (db) => {
      await db.query("SELECT set_member($1,$2,$3)", [
        data.user_id,
        data.role_id,
        data.active,
      ]);
      return { updated: true };
    });
  }
  @Post("workspaces/:tenant/work-orders/:record/progress") async progress(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("record") record: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "production:write"),
      data = z
        .object({
          version: z.number().int().positive(),
          completed: quantity,
          scrap: quantity,
          status: z.enum(["queued", "running", "paused", "done", "cancelled"]),
        })
        .strict()
        .parse(body);
    id.parse(record);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      const row = (
        await db.query(
          "UPDATE work_orders SET completed=$3,scrap=$4,status=$5,version=version+1 WHERE id=$1 AND version=$2 RETURNING *",
          [record, data.version, data.completed, data.scrap, data.status],
        )
      ).rows[0];
      if (!row)
        throw new HttpException("STALE_VERSION_RELOAD_BEFORE_RETRY", 409);
      return row;
    });
  }
  @Get("workspaces/:tenant/export/:name") async export(
    @Req() req: Request,
    @Res() res: Response,
    @Param("tenant") tenant: string,
    @Param("name") name: string,
  ) {
    const item = resource(name),
      current = await access(req, tenant, `${item.permission}:read`);
    if (["quotes", "purchases"].includes(name))
      await access(req, tenant, "cost:read");
    const rows = await transaction(
      current.user.id,
      tenant,
      async (db) =>
        (
          await db.query(
            `SELECT * FROM ${item.table} ${name === "notifications" ? "WHERE recipient=$1" : ""} ORDER BY id LIMIT 10000`,
            name === "notifications" ? [current.user.email] : [],
          )
        ).rows,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="olaph-${name}.xlsx"`,
    );
    res.send(Buffer.from(await workbookExport(rows, name)));
  }
  @Get("health") health() {
    return { service: "olaph-api", version: "0.2.0", status: "ok" };
  }
  @Get("ready") async ready() {
    await pool.query("SELECT 1");
    await authPool.query('SELECT 1 FROM "user" LIMIT 0');
    return { status: "ready" };
  }
}
