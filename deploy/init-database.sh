#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" --set=auth_password="$AUTH_DB_PASSWORD" <<'SQL'
CREATE ROLE olaph_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'app_password';
CREATE ROLE olaph_auth LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'auth_password';
CREATE SCHEMA auth AUTHORIZATION olaph_auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
