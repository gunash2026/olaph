CREATE TABLE custom_field_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 entity text NOT NULL CHECK(entity IN('materials','products','partners')),
 key text NOT NULL CHECK(key ~ '^[a-z][a-z0-9_]{0,39}$' AND key NOT IN('constructor','prototype')),
 label text NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 80),
 kind text NOT NULL CHECK(kind IN('text','decimal','boolean','date','select')),
 required boolean NOT NULL DEFAULT false,active boolean NOT NULL DEFAULT true,
 options jsonb NOT NULL DEFAULT '[]',position integer NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 999),
 UNIQUE(tenant_id,entity,key)
);
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON custom_field_definitions FOR SELECT TO olaph_runtime
 USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('catalog:read'));
CREATE POLICY tenant_insert ON custom_field_definitions FOR INSERT TO olaph_runtime
 WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('settings:write'));
CREATE POLICY tenant_update ON custom_field_definitions FOR UPDATE TO olaph_runtime
 USING(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('settings:write'))
 WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true) AND has_permission('settings:write'));
GRANT SELECT,INSERT,UPDATE ON custom_field_definitions TO olaph_runtime;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE FUNCTION custom_field_empty(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT value IS NULL OR value='null'::jsonb OR (jsonb_typeof(value)='string' AND length(trim(value #>> '{}'))=0)
$$;
CREATE FUNCTION custom_field_valid(kind text,value jsonb,options jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE raw text:=value #>> '{}';
BEGIN
 IF value IS NULL OR value='null'::jsonb THEN RETURN true; END IF;
 CASE kind
  WHEN 'text' THEN RETURN jsonb_typeof(value)='string' AND length(raw)<=500;
  WHEN 'decimal' THEN RETURN jsonb_typeof(value)='string' AND raw ~ '^-?[0-9]{1,12}(\.[0-9]{1,6})?$';
  WHEN 'boolean' THEN RETURN jsonb_typeof(value)='boolean';
  WHEN 'select' THEN RETURN jsonb_typeof(value)='string' AND options ? raw;
  WHEN 'date' THEN
   IF jsonb_typeof(value)<>'string' OR raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN false; END IF;
   BEGIN
    RETURN to_char(make_date(substring(raw,1,4)::int,substring(raw,6,2)::int,substring(raw,9,2)::int),'YYYY-MM-DD')=raw;
   EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN false;
   END;
  ELSE RETURN false;
 END CASE;
END $$;
REVOKE ALL ON FUNCTION custom_field_empty(jsonb),custom_field_valid(text,jsonb,jsonb) FROM PUBLIC;

CREATE FUNCTION protect_custom_field_definition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invalid boolean;
BEGIN
 IF NEW.tenant_id::text IS DISTINCT FROM current_setting('app.tenant_id',true) OR NOT has_permission('settings:write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT workspace_can_write() THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
 IF NEW.entity NOT IN('materials','products','partners') THEN RAISE EXCEPTION 'INVALID_CUSTOM_FIELD_DEFINITION'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.tenant_id,NEW.entity,NEW.key,NEW.kind) IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.entity,OLD.key,OLD.kind) THEN
  RAISE EXCEPTION 'CUSTOM_FIELD_IDENTITY_IMMUTABLE';
 END IF;
 -- Serialize schema changes with catalog writes so a concurrent edit cannot bypass validation.
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':custom-fields:'||NEW.entity,0));
 IF (NEW.active AND (SELECT count(*) FROM custom_field_definitions WHERE tenant_id=NEW.tenant_id AND entity=NEW.entity AND active AND id<>NEW.id)>=50)
   OR (TG_OP='INSERT' AND (SELECT count(*) FROM custom_field_definitions WHERE tenant_id=NEW.tenant_id AND entity=NEW.entity)>=200) THEN RAISE EXCEPTION 'CUSTOM_FIELD_LIMIT'; END IF;
 IF jsonb_typeof(NEW.options) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_CUSTOM_FIELD_DEFINITION'; END IF;
 IF jsonb_array_length(NEW.options)>50 THEN RAISE EXCEPTION 'INVALID_CUSTOM_FIELD_DEFINITION'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.options) entry WHERE jsonb_typeof(entry)<>'string' OR length(trim(entry #>> '{}')) NOT BETWEEN 1 AND 80 OR entry #>> '{}'<>trim(entry #>> '{}'))
   OR (SELECT count(*) FROM jsonb_array_elements(NEW.options))<>(SELECT count(DISTINCT entry) FROM jsonb_array_elements(NEW.options) entry)
   OR (NEW.kind='select' AND jsonb_array_length(NEW.options)=0) OR (NEW.kind<>'select' AND NEW.options<>'[]'::jsonb) THEN RAISE EXCEPTION 'INVALID_CUSTOM_FIELD_DEFINITION'; END IF;
 IF NEW.active THEN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE tenant_id=$1 AND (($4 AND custom_field_empty(custom_fields->$2)) OR NOT custom_field_valid($3,custom_fields->$2,$5)))',NEW.entity)
   INTO invalid USING NEW.tenant_id,NEW.key,NEW.kind,NEW.required,NEW.options;
  IF invalid THEN RAISE EXCEPTION 'CUSTOM_FIELD_EXISTING_VALUES_INVALID' USING DETAIL=NEW.key; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION protect_custom_field_definition() FROM PUBLIC;
CREATE TRIGGER validate_definition BEFORE INSERT OR UPDATE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION protect_custom_field_definition();

CREATE FUNCTION validate_catalog_custom_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE definition custom_field_definitions; field_key text; previous jsonb:='{}';
BEGIN
 IF NEW.tenant_id::text IS DISTINCT FROM current_setting('app.tenant_id',true) OR NOT has_permission('catalog:write') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT workspace_can_write() THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':custom-fields:'||TG_TABLE_NAME,0));
 IF jsonb_typeof(NEW.custom_fields) IS DISTINCT FROM 'object' OR pg_column_size(NEW.custom_fields)>65536 THEN RAISE EXCEPTION 'INVALID_CUSTOM_FIELDS'; END IF;
 IF TG_OP='UPDATE' THEN previous:=OLD.custom_fields; END IF;
 FOR field_key IN SELECT jsonb_object_keys(NEW.custom_fields) LOOP
  SELECT * INTO definition FROM custom_field_definitions WHERE tenant_id=NEW.tenant_id AND entity=TG_TABLE_NAME AND key=field_key;
  IF definition.id IS NULL OR NOT definition.active THEN
   -- Preserve pre-migration and archived values verbatim; do not silently drop or rewrite them.
   IF (NEW.custom_fields->field_key) IS DISTINCT FROM (previous->field_key) THEN RAISE EXCEPTION 'CUSTOM_FIELD_NOT_ACTIVE' USING DETAIL=field_key; END IF;
  END IF;
 END LOOP;
 FOR field_key IN SELECT jsonb_object_keys(previous) LOOP
  IF NOT NEW.custom_fields ? field_key AND NOT EXISTS(SELECT 1 FROM custom_field_definitions WHERE tenant_id=NEW.tenant_id AND entity=TG_TABLE_NAME AND key=field_key AND active) THEN
   RAISE EXCEPTION 'CUSTOM_FIELD_NOT_ACTIVE' USING DETAIL=field_key;
  END IF;
 END LOOP;
 FOR definition IN SELECT * FROM custom_field_definitions WHERE tenant_id=NEW.tenant_id AND entity=TG_TABLE_NAME AND active LOOP
  IF definition.required AND custom_field_empty(NEW.custom_fields->definition.key) THEN RAISE EXCEPTION 'CUSTOM_FIELD_REQUIRED' USING DETAIL=definition.key; END IF;
  IF NOT custom_field_valid(definition.kind,NEW.custom_fields->definition.key,definition.options) THEN RAISE EXCEPTION 'CUSTOM_FIELD_VALUE_INVALID' USING DETAIL=definition.key; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION validate_catalog_custom_fields() FROM PUBLIC;
CREATE TRIGGER validate_custom_fields BEFORE INSERT OR UPDATE OF custom_fields ON materials FOR EACH ROW EXECUTE FUNCTION validate_catalog_custom_fields();
CREATE TRIGGER validate_custom_fields BEFORE INSERT OR UPDATE OF custom_fields ON products FOR EACH ROW EXECUTE FUNCTION validate_catalog_custom_fields();
CREATE TRIGGER validate_custom_fields BEFORE INSERT OR UPDATE OF custom_fields ON partners FOR EACH ROW EXECUTE FUNCTION validate_catalog_custom_fields();
