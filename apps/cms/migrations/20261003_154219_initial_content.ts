import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."_locales" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_staff_role" AS ENUM('admin', 'editor', 'publisher');
  CREATE TYPE "cms"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__pages_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__posts_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_guides_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__guides_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__guides_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_glossary_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__glossary_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__glossary_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_legal_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__legal_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__legal_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_changelog_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__changelog_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__changelog_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_email_templates_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__email_templates_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__email_templates_v_published_locale" AS ENUM('tr', 'en', 'ar', 'zh', 'ru');
  CREATE TYPE "cms"."enum_plans_code" AS ENUM('starter', 'professional', 'enterprise');
  CREATE TYPE "cms"."enum__plans_v_version_code" AS ENUM('starter', 'professional', 'enterprise');
  CREATE TYPE "cms"."enum_service_status_status" AS ENUM('operational', 'degraded', 'outage', 'maintenance');
  CREATE TYPE "cms"."enum__service_status_v_version_status" AS ENUM('operational', 'degraded', 'outage', 'maintenance');
  CREATE TABLE "cms"."staff_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "cms"."staff" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "cms"."enum_staff_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."pages_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."pages_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__pages_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_pages_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_pages_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."posts_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."posts_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__posts_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_posts_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_posts_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_guides_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."guides_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."guides_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_guides_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__guides_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__guides_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_guides_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_guides_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."glossary" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_glossary_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."glossary_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."glossary_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_glossary_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__glossary_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__glossary_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_glossary_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_glossary_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."legal" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_legal_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."legal_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."legal_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_legal_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__legal_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__legal_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_legal_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_legal_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."changelog" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_changelog_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."changelog_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."changelog_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_changelog_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__changelog_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__changelog_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_changelog_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_changelog_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."email_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"author" varchar,
  	"published_at" timestamp(3) with time zone,
  	"document_version" varchar,
  	"reviewed_by" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_email_templates_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."email_templates_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."email_templates_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_email_templates_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_document_version" varchar,
  	"version_reviewed_by" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__email_templates_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__email_templates_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_email_templates_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_email_templates_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" "cms"."enum_plans_code" NOT NULL,
  	"monthly_usd" numeric NOT NULL,
  	"annual_months" numeric DEFAULT 10,
  	"included_seats" numeric,
  	"extra_seat_usd" numeric DEFAULT 8,
  	"trial_days" numeric DEFAULT 14,
  	"features" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."plans_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_plans_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_code" "cms"."enum__plans_v_version_code" NOT NULL,
  	"version_monthly_usd" numeric NOT NULL,
  	"version_annual_months" numeric DEFAULT 10,
  	"version_included_seats" numeric,
  	"version_extra_seat_usd" numeric DEFAULT 8,
  	"version_trial_days" numeric DEFAULT 14,
  	"version_features" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."_plans_v_locales" (
  	"version_name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."service_status" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"service" varchar NOT NULL,
  	"status" "cms"."enum_service_status_status" NOT NULL,
  	"observed_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."service_status_locales" (
  	"message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."_service_status_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_service" varchar NOT NULL,
  	"version_status" "cms"."enum__service_status_v_version_status" NOT NULL,
  	"version_observed_at" timestamp(3) with time zone NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."_service_status_v_locales" (
  	"version_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"staff_id" integer,
  	"pages_id" integer,
  	"posts_id" integer,
  	"guides_id" integer,
  	"glossary_id" integer,
  	"legal_id" integer,
  	"changelog_id" integer,
  	"email_templates_id" integer,
  	"plans_id" integer,
  	"service_status_id" integer
  );
  
  CREATE TABLE "cms"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"staff_id" integer
  );
  
  CREATE TABLE "cms"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms"."staff_sessions" ADD CONSTRAINT "staff_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_texts" ADD CONSTRAINT "pages_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_texts" ADD CONSTRAINT "_pages_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_texts" ADD CONSTRAINT "posts_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_texts" ADD CONSTRAINT "_posts_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."guides_locales" ADD CONSTRAINT "guides_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."guides_texts" ADD CONSTRAINT "guides_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_guides_v" ADD CONSTRAINT "_guides_v_parent_id_guides_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."guides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_guides_v_locales" ADD CONSTRAINT "_guides_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_guides_v_texts" ADD CONSTRAINT "_guides_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_guides_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."glossary_locales" ADD CONSTRAINT "glossary_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."glossary"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."glossary_texts" ADD CONSTRAINT "glossary_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."glossary"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_glossary_v" ADD CONSTRAINT "_glossary_v_parent_id_glossary_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."glossary"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_glossary_v_locales" ADD CONSTRAINT "_glossary_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_glossary_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_glossary_v_texts" ADD CONSTRAINT "_glossary_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_glossary_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."legal_locales" ADD CONSTRAINT "legal_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."legal"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."legal_texts" ADD CONSTRAINT "legal_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."legal"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_legal_v" ADD CONSTRAINT "_legal_v_parent_id_legal_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."legal"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_legal_v_locales" ADD CONSTRAINT "_legal_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_legal_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_legal_v_texts" ADD CONSTRAINT "_legal_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_legal_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_locales" ADD CONSTRAINT "changelog_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_texts" ADD CONSTRAINT "changelog_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v" ADD CONSTRAINT "_changelog_v_parent_id_changelog_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."changelog"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_locales" ADD CONSTRAINT "_changelog_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_texts" ADD CONSTRAINT "_changelog_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."email_templates_locales" ADD CONSTRAINT "email_templates_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."email_templates_texts" ADD CONSTRAINT "email_templates_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_email_templates_v" ADD CONSTRAINT "_email_templates_v_parent_id_email_templates_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."email_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_email_templates_v_locales" ADD CONSTRAINT "_email_templates_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_email_templates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_email_templates_v_texts" ADD CONSTRAINT "_email_templates_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_email_templates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."plans_locales" ADD CONSTRAINT "plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_plans_v" ADD CONSTRAINT "_plans_v_parent_id_plans_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_plans_v_locales" ADD CONSTRAINT "_plans_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."service_status_locales" ADD CONSTRAINT "service_status_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."service_status"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_service_status_v" ADD CONSTRAINT "_service_status_v_parent_id_service_status_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."service_status"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_service_status_v_locales" ADD CONSTRAINT "_service_status_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_service_status_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "cms"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guides_fk" FOREIGN KEY ("guides_id") REFERENCES "cms"."guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_glossary_fk" FOREIGN KEY ("glossary_id") REFERENCES "cms"."glossary"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_fk" FOREIGN KEY ("legal_id") REFERENCES "cms"."legal"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_changelog_fk" FOREIGN KEY ("changelog_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_templates_fk" FOREIGN KEY ("email_templates_id") REFERENCES "cms"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_status_fk" FOREIGN KEY ("service_status_id") REFERENCES "cms"."service_status"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "cms"."staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "staff_sessions_order_idx" ON "cms"."staff_sessions" USING btree ("_order");
  CREATE INDEX "staff_sessions_parent_id_idx" ON "cms"."staff_sessions" USING btree ("_parent_id");
  CREATE INDEX "staff_updated_at_idx" ON "cms"."staff" USING btree ("updated_at");
  CREATE INDEX "staff_created_at_idx" ON "cms"."staff" USING btree ("created_at");
  CREATE UNIQUE INDEX "staff_email_idx" ON "cms"."staff" USING btree ("email");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "cms"."pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "cms"."pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "cms"."pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "cms"."pages" USING btree ("_status");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "cms"."pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_texts_order_parent" ON "cms"."pages_texts" USING btree ("order","parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "cms"."_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "cms"."_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "cms"."_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "cms"."_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "cms"."_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "cms"."_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "cms"."_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_snapshot_idx" ON "cms"."_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "cms"."_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_latest_idx" ON "cms"."_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "cms"."_pages_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "cms"."_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_texts_order_parent" ON "cms"."_pages_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "cms"."posts" USING btree ("slug");
  CREATE INDEX "posts_updated_at_idx" ON "cms"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "cms"."posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "cms"."posts" USING btree ("_status");
  CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "cms"."posts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "posts_texts_order_parent" ON "cms"."posts_texts" USING btree ("order","parent_id");
  CREATE INDEX "_posts_v_parent_idx" ON "cms"."_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "cms"."_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "cms"."_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "cms"."_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "cms"."_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "cms"."_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "cms"."_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_snapshot_idx" ON "cms"."_posts_v" USING btree ("snapshot");
  CREATE INDEX "_posts_v_published_locale_idx" ON "cms"."_posts_v" USING btree ("published_locale");
  CREATE INDEX "_posts_v_latest_idx" ON "cms"."_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "cms"."_posts_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_posts_v_locales_locale_parent_id_unique" ON "cms"."_posts_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_posts_v_texts_order_parent" ON "cms"."_posts_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "guides_slug_idx" ON "cms"."guides" USING btree ("slug");
  CREATE INDEX "guides_updated_at_idx" ON "cms"."guides" USING btree ("updated_at");
  CREATE INDEX "guides_created_at_idx" ON "cms"."guides" USING btree ("created_at");
  CREATE INDEX "guides__status_idx" ON "cms"."guides" USING btree ("_status");
  CREATE UNIQUE INDEX "guides_locales_locale_parent_id_unique" ON "cms"."guides_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "guides_texts_order_parent" ON "cms"."guides_texts" USING btree ("order","parent_id");
  CREATE INDEX "_guides_v_parent_idx" ON "cms"."_guides_v" USING btree ("parent_id");
  CREATE INDEX "_guides_v_version_version_slug_idx" ON "cms"."_guides_v" USING btree ("version_slug");
  CREATE INDEX "_guides_v_version_version_updated_at_idx" ON "cms"."_guides_v" USING btree ("version_updated_at");
  CREATE INDEX "_guides_v_version_version_created_at_idx" ON "cms"."_guides_v" USING btree ("version_created_at");
  CREATE INDEX "_guides_v_version_version__status_idx" ON "cms"."_guides_v" USING btree ("version__status");
  CREATE INDEX "_guides_v_created_at_idx" ON "cms"."_guides_v" USING btree ("created_at");
  CREATE INDEX "_guides_v_updated_at_idx" ON "cms"."_guides_v" USING btree ("updated_at");
  CREATE INDEX "_guides_v_snapshot_idx" ON "cms"."_guides_v" USING btree ("snapshot");
  CREATE INDEX "_guides_v_published_locale_idx" ON "cms"."_guides_v" USING btree ("published_locale");
  CREATE INDEX "_guides_v_latest_idx" ON "cms"."_guides_v" USING btree ("latest");
  CREATE INDEX "_guides_v_autosave_idx" ON "cms"."_guides_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_guides_v_locales_locale_parent_id_unique" ON "cms"."_guides_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_guides_v_texts_order_parent" ON "cms"."_guides_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "glossary_slug_idx" ON "cms"."glossary" USING btree ("slug");
  CREATE INDEX "glossary_updated_at_idx" ON "cms"."glossary" USING btree ("updated_at");
  CREATE INDEX "glossary_created_at_idx" ON "cms"."glossary" USING btree ("created_at");
  CREATE INDEX "glossary__status_idx" ON "cms"."glossary" USING btree ("_status");
  CREATE UNIQUE INDEX "glossary_locales_locale_parent_id_unique" ON "cms"."glossary_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "glossary_texts_order_parent" ON "cms"."glossary_texts" USING btree ("order","parent_id");
  CREATE INDEX "_glossary_v_parent_idx" ON "cms"."_glossary_v" USING btree ("parent_id");
  CREATE INDEX "_glossary_v_version_version_slug_idx" ON "cms"."_glossary_v" USING btree ("version_slug");
  CREATE INDEX "_glossary_v_version_version_updated_at_idx" ON "cms"."_glossary_v" USING btree ("version_updated_at");
  CREATE INDEX "_glossary_v_version_version_created_at_idx" ON "cms"."_glossary_v" USING btree ("version_created_at");
  CREATE INDEX "_glossary_v_version_version__status_idx" ON "cms"."_glossary_v" USING btree ("version__status");
  CREATE INDEX "_glossary_v_created_at_idx" ON "cms"."_glossary_v" USING btree ("created_at");
  CREATE INDEX "_glossary_v_updated_at_idx" ON "cms"."_glossary_v" USING btree ("updated_at");
  CREATE INDEX "_glossary_v_snapshot_idx" ON "cms"."_glossary_v" USING btree ("snapshot");
  CREATE INDEX "_glossary_v_published_locale_idx" ON "cms"."_glossary_v" USING btree ("published_locale");
  CREATE INDEX "_glossary_v_latest_idx" ON "cms"."_glossary_v" USING btree ("latest");
  CREATE INDEX "_glossary_v_autosave_idx" ON "cms"."_glossary_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_glossary_v_locales_locale_parent_id_unique" ON "cms"."_glossary_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_glossary_v_texts_order_parent" ON "cms"."_glossary_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "legal_slug_idx" ON "cms"."legal" USING btree ("slug");
  CREATE INDEX "legal_updated_at_idx" ON "cms"."legal" USING btree ("updated_at");
  CREATE INDEX "legal_created_at_idx" ON "cms"."legal" USING btree ("created_at");
  CREATE INDEX "legal__status_idx" ON "cms"."legal" USING btree ("_status");
  CREATE UNIQUE INDEX "legal_locales_locale_parent_id_unique" ON "cms"."legal_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "legal_texts_order_parent" ON "cms"."legal_texts" USING btree ("order","parent_id");
  CREATE INDEX "_legal_v_parent_idx" ON "cms"."_legal_v" USING btree ("parent_id");
  CREATE INDEX "_legal_v_version_version_slug_idx" ON "cms"."_legal_v" USING btree ("version_slug");
  CREATE INDEX "_legal_v_version_version_updated_at_idx" ON "cms"."_legal_v" USING btree ("version_updated_at");
  CREATE INDEX "_legal_v_version_version_created_at_idx" ON "cms"."_legal_v" USING btree ("version_created_at");
  CREATE INDEX "_legal_v_version_version__status_idx" ON "cms"."_legal_v" USING btree ("version__status");
  CREATE INDEX "_legal_v_created_at_idx" ON "cms"."_legal_v" USING btree ("created_at");
  CREATE INDEX "_legal_v_updated_at_idx" ON "cms"."_legal_v" USING btree ("updated_at");
  CREATE INDEX "_legal_v_snapshot_idx" ON "cms"."_legal_v" USING btree ("snapshot");
  CREATE INDEX "_legal_v_published_locale_idx" ON "cms"."_legal_v" USING btree ("published_locale");
  CREATE INDEX "_legal_v_latest_idx" ON "cms"."_legal_v" USING btree ("latest");
  CREATE INDEX "_legal_v_autosave_idx" ON "cms"."_legal_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_legal_v_locales_locale_parent_id_unique" ON "cms"."_legal_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_legal_v_texts_order_parent" ON "cms"."_legal_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "changelog_slug_idx" ON "cms"."changelog" USING btree ("slug");
  CREATE INDEX "changelog_updated_at_idx" ON "cms"."changelog" USING btree ("updated_at");
  CREATE INDEX "changelog_created_at_idx" ON "cms"."changelog" USING btree ("created_at");
  CREATE INDEX "changelog__status_idx" ON "cms"."changelog" USING btree ("_status");
  CREATE UNIQUE INDEX "changelog_locales_locale_parent_id_unique" ON "cms"."changelog_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "changelog_texts_order_parent" ON "cms"."changelog_texts" USING btree ("order","parent_id");
  CREATE INDEX "_changelog_v_parent_idx" ON "cms"."_changelog_v" USING btree ("parent_id");
  CREATE INDEX "_changelog_v_version_version_slug_idx" ON "cms"."_changelog_v" USING btree ("version_slug");
  CREATE INDEX "_changelog_v_version_version_updated_at_idx" ON "cms"."_changelog_v" USING btree ("version_updated_at");
  CREATE INDEX "_changelog_v_version_version_created_at_idx" ON "cms"."_changelog_v" USING btree ("version_created_at");
  CREATE INDEX "_changelog_v_version_version__status_idx" ON "cms"."_changelog_v" USING btree ("version__status");
  CREATE INDEX "_changelog_v_created_at_idx" ON "cms"."_changelog_v" USING btree ("created_at");
  CREATE INDEX "_changelog_v_updated_at_idx" ON "cms"."_changelog_v" USING btree ("updated_at");
  CREATE INDEX "_changelog_v_snapshot_idx" ON "cms"."_changelog_v" USING btree ("snapshot");
  CREATE INDEX "_changelog_v_published_locale_idx" ON "cms"."_changelog_v" USING btree ("published_locale");
  CREATE INDEX "_changelog_v_latest_idx" ON "cms"."_changelog_v" USING btree ("latest");
  CREATE INDEX "_changelog_v_autosave_idx" ON "cms"."_changelog_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_changelog_v_locales_locale_parent_id_unique" ON "cms"."_changelog_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_changelog_v_texts_order_parent" ON "cms"."_changelog_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "email_templates_slug_idx" ON "cms"."email_templates" USING btree ("slug");
  CREATE INDEX "email_templates_updated_at_idx" ON "cms"."email_templates" USING btree ("updated_at");
  CREATE INDEX "email_templates_created_at_idx" ON "cms"."email_templates" USING btree ("created_at");
  CREATE INDEX "email_templates__status_idx" ON "cms"."email_templates" USING btree ("_status");
  CREATE UNIQUE INDEX "email_templates_locales_locale_parent_id_unique" ON "cms"."email_templates_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "email_templates_texts_order_parent" ON "cms"."email_templates_texts" USING btree ("order","parent_id");
  CREATE INDEX "_email_templates_v_parent_idx" ON "cms"."_email_templates_v" USING btree ("parent_id");
  CREATE INDEX "_email_templates_v_version_version_slug_idx" ON "cms"."_email_templates_v" USING btree ("version_slug");
  CREATE INDEX "_email_templates_v_version_version_updated_at_idx" ON "cms"."_email_templates_v" USING btree ("version_updated_at");
  CREATE INDEX "_email_templates_v_version_version_created_at_idx" ON "cms"."_email_templates_v" USING btree ("version_created_at");
  CREATE INDEX "_email_templates_v_version_version__status_idx" ON "cms"."_email_templates_v" USING btree ("version__status");
  CREATE INDEX "_email_templates_v_created_at_idx" ON "cms"."_email_templates_v" USING btree ("created_at");
  CREATE INDEX "_email_templates_v_updated_at_idx" ON "cms"."_email_templates_v" USING btree ("updated_at");
  CREATE INDEX "_email_templates_v_snapshot_idx" ON "cms"."_email_templates_v" USING btree ("snapshot");
  CREATE INDEX "_email_templates_v_published_locale_idx" ON "cms"."_email_templates_v" USING btree ("published_locale");
  CREATE INDEX "_email_templates_v_latest_idx" ON "cms"."_email_templates_v" USING btree ("latest");
  CREATE INDEX "_email_templates_v_autosave_idx" ON "cms"."_email_templates_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_email_templates_v_locales_locale_parent_id_unique" ON "cms"."_email_templates_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_email_templates_v_texts_order_parent" ON "cms"."_email_templates_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "plans_code_idx" ON "cms"."plans" USING btree ("code");
  CREATE INDEX "plans_updated_at_idx" ON "cms"."plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "cms"."plans" USING btree ("created_at");
  CREATE UNIQUE INDEX "plans_locales_locale_parent_id_unique" ON "cms"."plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_plans_v_parent_idx" ON "cms"."_plans_v" USING btree ("parent_id");
  CREATE INDEX "_plans_v_version_version_code_idx" ON "cms"."_plans_v" USING btree ("version_code");
  CREATE INDEX "_plans_v_version_version_updated_at_idx" ON "cms"."_plans_v" USING btree ("version_updated_at");
  CREATE INDEX "_plans_v_version_version_created_at_idx" ON "cms"."_plans_v" USING btree ("version_created_at");
  CREATE INDEX "_plans_v_created_at_idx" ON "cms"."_plans_v" USING btree ("created_at");
  CREATE INDEX "_plans_v_updated_at_idx" ON "cms"."_plans_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_plans_v_locales_locale_parent_id_unique" ON "cms"."_plans_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "service_status_updated_at_idx" ON "cms"."service_status" USING btree ("updated_at");
  CREATE INDEX "service_status_created_at_idx" ON "cms"."service_status" USING btree ("created_at");
  CREATE UNIQUE INDEX "service_status_locales_locale_parent_id_unique" ON "cms"."service_status_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_service_status_v_parent_idx" ON "cms"."_service_status_v" USING btree ("parent_id");
  CREATE INDEX "_service_status_v_version_version_updated_at_idx" ON "cms"."_service_status_v" USING btree ("version_updated_at");
  CREATE INDEX "_service_status_v_version_version_created_at_idx" ON "cms"."_service_status_v" USING btree ("version_created_at");
  CREATE INDEX "_service_status_v_created_at_idx" ON "cms"."_service_status_v" USING btree ("created_at");
  CREATE INDEX "_service_status_v_updated_at_idx" ON "cms"."_service_status_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_service_status_v_locales_locale_parent_id_unique" ON "cms"."_service_status_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_staff_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("staff_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_guides_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("guides_id");
  CREATE INDEX "payload_locked_documents_rels_glossary_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("glossary_id");
  CREATE INDEX "payload_locked_documents_rels_legal_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("legal_id");
  CREATE INDEX "payload_locked_documents_rels_changelog_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("changelog_id");
  CREATE INDEX "payload_locked_documents_rels_email_templates_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("email_templates_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_service_status_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("service_status_id");
  CREATE INDEX "payload_preferences_key_idx" ON "cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_staff_id_idx" ON "cms"."payload_preferences_rels" USING btree ("staff_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "cms"."payload_migrations" USING btree ("created_at");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."staff_sessions" CASCADE;
  DROP TABLE "cms"."staff" CASCADE;
  DROP TABLE "cms"."pages" CASCADE;
  DROP TABLE "cms"."pages_locales" CASCADE;
  DROP TABLE "cms"."pages_texts" CASCADE;
  DROP TABLE "cms"."_pages_v" CASCADE;
  DROP TABLE "cms"."_pages_v_locales" CASCADE;
  DROP TABLE "cms"."_pages_v_texts" CASCADE;
  DROP TABLE "cms"."posts" CASCADE;
  DROP TABLE "cms"."posts_locales" CASCADE;
  DROP TABLE "cms"."posts_texts" CASCADE;
  DROP TABLE "cms"."_posts_v" CASCADE;
  DROP TABLE "cms"."_posts_v_locales" CASCADE;
  DROP TABLE "cms"."_posts_v_texts" CASCADE;
  DROP TABLE "cms"."guides" CASCADE;
  DROP TABLE "cms"."guides_locales" CASCADE;
  DROP TABLE "cms"."guides_texts" CASCADE;
  DROP TABLE "cms"."_guides_v" CASCADE;
  DROP TABLE "cms"."_guides_v_locales" CASCADE;
  DROP TABLE "cms"."_guides_v_texts" CASCADE;
  DROP TABLE "cms"."glossary" CASCADE;
  DROP TABLE "cms"."glossary_locales" CASCADE;
  DROP TABLE "cms"."glossary_texts" CASCADE;
  DROP TABLE "cms"."_glossary_v" CASCADE;
  DROP TABLE "cms"."_glossary_v_locales" CASCADE;
  DROP TABLE "cms"."_glossary_v_texts" CASCADE;
  DROP TABLE "cms"."legal" CASCADE;
  DROP TABLE "cms"."legal_locales" CASCADE;
  DROP TABLE "cms"."legal_texts" CASCADE;
  DROP TABLE "cms"."_legal_v" CASCADE;
  DROP TABLE "cms"."_legal_v_locales" CASCADE;
  DROP TABLE "cms"."_legal_v_texts" CASCADE;
  DROP TABLE "cms"."changelog" CASCADE;
  DROP TABLE "cms"."changelog_locales" CASCADE;
  DROP TABLE "cms"."changelog_texts" CASCADE;
  DROP TABLE "cms"."_changelog_v" CASCADE;
  DROP TABLE "cms"."_changelog_v_locales" CASCADE;
  DROP TABLE "cms"."_changelog_v_texts" CASCADE;
  DROP TABLE "cms"."email_templates" CASCADE;
  DROP TABLE "cms"."email_templates_locales" CASCADE;
  DROP TABLE "cms"."email_templates_texts" CASCADE;
  DROP TABLE "cms"."_email_templates_v" CASCADE;
  DROP TABLE "cms"."_email_templates_v_locales" CASCADE;
  DROP TABLE "cms"."_email_templates_v_texts" CASCADE;
  DROP TABLE "cms"."plans" CASCADE;
  DROP TABLE "cms"."plans_locales" CASCADE;
  DROP TABLE "cms"."_plans_v" CASCADE;
  DROP TABLE "cms"."_plans_v_locales" CASCADE;
  DROP TABLE "cms"."service_status" CASCADE;
  DROP TABLE "cms"."service_status_locales" CASCADE;
  DROP TABLE "cms"."_service_status_v" CASCADE;
  DROP TABLE "cms"."_service_status_v_locales" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_locked_documents" CASCADE;
  DROP TABLE "cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "cms"."payload_preferences" CASCADE;
  DROP TABLE "cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "cms"."payload_migrations" CASCADE;
  DROP TYPE "cms"."_locales";
  DROP TYPE "cms"."enum_staff_role";
  DROP TYPE "cms"."enum_pages_status";
  DROP TYPE "cms"."enum__pages_v_version_status";
  DROP TYPE "cms"."enum__pages_v_published_locale";
  DROP TYPE "cms"."enum_posts_status";
  DROP TYPE "cms"."enum__posts_v_version_status";
  DROP TYPE "cms"."enum__posts_v_published_locale";
  DROP TYPE "cms"."enum_guides_status";
  DROP TYPE "cms"."enum__guides_v_version_status";
  DROP TYPE "cms"."enum__guides_v_published_locale";
  DROP TYPE "cms"."enum_glossary_status";
  DROP TYPE "cms"."enum__glossary_v_version_status";
  DROP TYPE "cms"."enum__glossary_v_published_locale";
  DROP TYPE "cms"."enum_legal_status";
  DROP TYPE "cms"."enum__legal_v_version_status";
  DROP TYPE "cms"."enum__legal_v_published_locale";
  DROP TYPE "cms"."enum_changelog_status";
  DROP TYPE "cms"."enum__changelog_v_version_status";
  DROP TYPE "cms"."enum__changelog_v_published_locale";
  DROP TYPE "cms"."enum_email_templates_status";
  DROP TYPE "cms"."enum__email_templates_v_version_status";
  DROP TYPE "cms"."enum__email_templates_v_published_locale";
  DROP TYPE "cms"."enum_plans_code";
  DROP TYPE "cms"."enum__plans_v_version_code";
  DROP TYPE "cms"."enum_service_status_status";
  DROP TYPE "cms"."enum__service_status_v_version_status";`);
}
