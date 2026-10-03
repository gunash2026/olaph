import config from "@payload-config";
import {
  REST_GET,
  REST_POST,
  REST_DELETE,
  REST_PATCH,
  REST_PUT,
  REST_OPTIONS,
} from "@payloadcms/next/routes";
export const GET = REST_GET(config),
  POST = REST_POST(config),
  DELETE = REST_DELETE(config),
  PATCH = REST_PATCH(config),
  PUT = REST_PUT(config),
  OPTIONS = REST_OPTIONS(config);
