import {
  buildConfig,
  type CollectionConfig,
  type Access,
  type FieldAccess,
} from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import { cmsEmail } from "./src/email.js";
const role = (user: unknown) =>
  user && typeof user === "object" && "role" in user ? String(user.role) : "";
const staff: Access = ({ req }) =>
  ["admin", "editor", "publisher"].includes(role(req.user));
const admin: Access = ({ req }) => role(req.user) === "admin";
const published: Access = ({ req }) =>
  ["admin", "editor", "publisher"].includes(role(req.user))
    ? true
    : { _status: { equals: "published" } };
const publishField: FieldAccess = ({ req }) =>
  ["admin", "publisher"].includes(role(req.user));
const collections: CollectionConfig[] = [
  {
    slug: "staff",
    admin: { useAsTitle: "email" },
    auth: {
      tokenExpiration: 3600,
      maxLoginAttempts: 5,
      lockTime: 900000,
      cookies: {
        secure: process.env.CMS_PUBLIC_URL
          ? new URL(process.env.CMS_PUBLIC_URL).protocol === "https:"
          : process.env.NODE_ENV === "production",
        sameSite: "Strict",
      },
    },
    access: {
      create: admin,
      read: admin,
      update: admin,
      delete: admin,
      admin: ({ req }) =>
        ["admin", "editor", "publisher"].includes(role(req.user)),
    },
    hooks: {
      beforeChange: [
        ({ data, operation, req }) => {
          if (operation === "create" && !req.user && !req.context.bootstrap)
            throw Error(
              "Use the protected bootstrap command to create the first administrator.",
            );
          return data;
        },
      ],
    },
    fields: [
      { name: "name", type: "text", required: true },
      {
        name: "role",
        type: "select",
        options: ["admin", "editor", "publisher"],
        required: true,
        defaultValue: "editor",
        access: { update: ({ req }) => role(req.user) === "admin" },
      },
    ],
  },
  ...[
    "pages",
    "posts",
    "guides",
    "glossary",
    "legal",
    "changelog",
    "email-templates",
  ].map(
    (slug): CollectionConfig => ({
      slug,
      admin: {
        useAsTitle: "title",
        defaultColumns: ["title", "slug", "_status", "updatedAt"],
      },
      access: {
        read: slug === "email-templates" ? staff : published,
        create: staff,
        update: staff,
        delete: admin,
      },
      versions: { drafts: { autosave: { interval: 5000 } }, maxPerDoc: 30 },
      fields: [
        { name: "title", type: "text", localized: true, required: true },
        { name: "slug", type: "text", unique: true, required: true },
        { name: "summary", type: "textarea", localized: true },
        { name: "body", type: "richText", localized: true },
        { name: "category", type: "text", localized: true },
        { name: "tags", type: "text", hasMany: true },
        { name: "author", type: "text" },
        { name: "publishedAt", type: "date" },
        { name: "documentVersion", type: "text" },
        {
          name: "reviewedBy",
          type: "text",
          access: { create: publishField, update: publishField },
        },
        {
          name: "seo",
          type: "group",
          fields: [
            { name: "title", type: "text", localized: true },
            { name: "description", type: "textarea", localized: true },
            { name: "noIndex", type: "checkbox", defaultValue: false },
          ],
        },
        {
          name: "_status",
          type: "select",
          options: [],
          defaultValue: "draft",
          access: { create: publishField, update: publishField },
        },
      ],
      hooks: {
        beforeChange: [
          ({ data, req, originalDoc }) => {
            if (
              (data._status === "published" ||
                originalDoc?._status === "published") &&
              !["admin", "publisher"].includes(role(req.user))
            )
              throw Error("Publisher approval required.");
            if (
              slug === "legal" &&
              data._status === "published" &&
              !(data.reviewedBy || originalDoc?.reviewedBy)
            )
              throw Error("Legal reviewer required.");
            return data;
          },
        ],
      },
    }),
  ),
  {
    slug: "plans",
    admin: { useAsTitle: "name" },
    access: {
      read: () => true,
      create: admin,
      update: admin,
      delete: () => false,
    },
    versions: { maxPerDoc: 30 },
    fields: [
      {
        name: "code",
        type: "select",
        options: ["starter", "professional", "enterprise"],
        unique: true,
        required: true,
      },
      { name: "name", type: "text", localized: true, required: true },
      { name: "monthlyUsd", type: "number", min: 0, required: true },
      {
        name: "annualMonths",
        type: "number",
        min: 1,
        max: 12,
        defaultValue: 10,
      },
      { name: "includedSeats", type: "number", min: 1 },
      { name: "extraSeatUsd", type: "number", defaultValue: 8 },
      { name: "trialDays", type: "number", defaultValue: 14 },
      { name: "features", type: "json" },
    ],
  },
  {
    slug: "service-status",
    admin: { useAsTitle: "service" },
    access: { read: () => true, create: admin, update: admin, delete: admin },
    versions: { maxPerDoc: 100 },
    fields: [
      { name: "service", type: "text", required: true },
      {
        name: "status",
        type: "select",
        options: ["operational", "degraded", "outage", "maintenance"],
        required: true,
      },
      { name: "message", type: "textarea", localized: true },
      { name: "observedAt", type: "date", required: true },
    ],
  },
];
export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  sharp,
  email: cmsEmail,
  serverURL: process.env.CMS_PUBLIC_URL || "http://localhost:3100",
  csrf: [process.env.CMS_PUBLIC_URL || "http://localhost:3100"],
  editor: lexicalEditor(),
  admin: {
    user: "staff",
    meta: {
      titleSuffix: "· OLAPH İçerik",
      robots: { index: false, follow: false },
    },
  },
  localization: {
    locales: ["tr", "en", "ar", "zh", "ru"],
    defaultLocale: "tr",
    fallback: false,
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.CMS_DATABASE_URL || "" },
    schemaName: "cms",
    push: false,
  }),
  collections,
  typescript: { outputFile: "./payload-types.ts" },
  graphQL: { disable: true },
});
