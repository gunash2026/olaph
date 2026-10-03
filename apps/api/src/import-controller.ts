import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  HttpException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { transaction } from "./db.js";
import { id } from "./resources.js";
import { access, entitlement } from "./security.js";
import { VerifiedUserGuard } from "./verified-user.guard.js";
import {
  scanFile,
  readWorkbook,
  mappingSchema,
  mappedRows,
  digest,
  type ImportSheet,
} from "./excel.js";
@Controller("api/workspaces/:tenant/imports")
@UseGuards(VerifiedUserGuard)
export class ImportController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const current = await access(req, tenant, "orders:write");
    if (!file || !file.originalname.toLowerCase().endsWith(".xlsx"))
      throw new BadRequestException("XLSX_REQUIRED");
    await scanFile(file.buffer);
    const sheets = await readWorkbook(file.buffer);
    return transaction(
      current.user.id,
      tenant,
      async (db) =>
        (
          await db.query(
            "INSERT INTO import_jobs(tenant_id,created_by,file_name,sha256,rows) VALUES($1,$2,$3,$4,$5) RETURNING id,rows",
            [
              tenant,
              current.user.id,
              file.originalname.slice(0, 160),
              digest(file.buffer),
              JSON.stringify(sheets),
            ],
          )
        ).rows[0],
    );
  }
  @Post(":record/preview") async preview(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("record") record: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "orders:write"),
      mapping = mappingSchema.parse(body);
    id.parse(record);
    return transaction(current.user.id, tenant, async (db) => {
      const job = (
        await db.query(
          "SELECT rows FROM import_jobs WHERE id=$1 AND status='preview'",
          [record],
        )
      ).rows[0];
      if (!job) throw new NotFoundException();
      const rows = mappedRows(job.rows as ImportSheet[], mapping),
        table = mapping.mode === "order_lines" ? "products" : "materials",
        catalog = (
          await db.query(`SELECT id,code FROM ${table} WHERE code=ANY($1)`, [
            rows.map((x) => x.code),
          ])
        ).rows;
      return {
        items: rows.map((row) => ({
          ...row,
          match: catalog.find((c) => c.code === row.code)?.id ?? null,
          error:
            row.error ||
            (!catalog.some((c) => c.code === row.code) ? "UNKNOWN_CODE" : null),
        })),
      };
    });
  }
  @Post(":record/confirm") async confirm(
    @Req() req: Request,
    @Param("tenant") tenant: string,
    @Param("record") record: string,
    @Body() body: unknown,
  ) {
    const current = await access(req, tenant, "orders:write"),
      mapping = mappingSchema.parse(body);
    id.parse(record);
    return transaction(current.user.id, tenant, async (db) => {
      await entitlement(db);
      const job = (
        await db.query(
          "SELECT rows FROM import_jobs WHERE id=$1 AND status='preview' FOR UPDATE",
          [record],
        )
      ).rows[0];
      if (!job) throw new HttpException("IMPORT_ALREADY_PROCESSED", 409);
      if (
        !(
          await db.query(
            "SELECT id FROM orders WHERE id=$1 AND status='draft' FOR UPDATE",
            [mapping.orderId],
          )
        ).rowCount
      )
        throw new BadRequestException("DRAFT_ORDER_REQUIRED");
      const rows = mappedRows(job.rows, mapping);
      if (!rows.length || rows.some((x) => x.error))
        throw new BadRequestException("INVALID_ROWS");
      const table = mapping.mode === "order_lines" ? "products" : "materials",
        column = mapping.mode === "order_lines" ? "product_id" : "material_id",
        target =
          mapping.mode === "order_lines"
            ? "order_lines"
            : "material_requirements",
        catalog = (
          await db.query(`SELECT id,code FROM ${table} WHERE code=ANY($1)`, [
            rows.map((x) => x.code),
          ])
        ).rows;
      for (const row of rows) {
        const match = catalog.find((c) => c.code === row.code);
        if (!match) throw new BadRequestException("UNKNOWN_CODE");
        await db.query(
          `INSERT INTO ${target}(tenant_id,order_id,${column},quantity) VALUES($1,$2,$3,$4)`,
          [tenant, mapping.orderId, match.id, row.quantity],
        );
      }
      await db.query(
        "UPDATE import_jobs SET mapping=$2,status='confirmed' WHERE id=$1",
        [record, JSON.stringify(mapping)],
      );
      return { imported: rows.length };
    });
  }
}
