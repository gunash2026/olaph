#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" --set=auth_password="$AUTH_DB_PASSWORD" --set=worker_password="$WORKER_DB_PASSWORD" --set=cms_password="$CMS_DB_PASSWORD" <<'SQL'
CREATE ROLE olaph_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'app_password';
CREATE ROLE olaph_auth LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'auth_password';
CREATE ROLE olaph_worker_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'worker_password';
CREATE ROLE olaph_cms LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'cms_password';
CREATE SCHEMA auth AUTHORIZATION olaph_auth;
CREATE SCHEMA cms AUTHORIZATION olaph_cms;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
