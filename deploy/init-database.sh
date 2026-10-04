#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" --set=auth_password="$AUTH_DB_PASSWORD" --set=worker_password="$WORKER_DB_PASSWORD" --set=cms_password="$CMS_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE olaph_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'app_password') WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='olaph_login') \gexec
SELECT format('CREATE ROLE olaph_auth LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'auth_password') WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='olaph_auth') \gexec
SELECT format('CREATE ROLE olaph_worker_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'worker_password') WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='olaph_worker_login') \gexec
SELECT format('CREATE ROLE olaph_cms LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'cms_password') WHERE NOT EXISTS(SELECT FROM pg_roles WHERE rolname='olaph_cms') \gexec
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION olaph_auth;
CREATE SCHEMA IF NOT EXISTS cms AUTHORIZATION olaph_cms;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
