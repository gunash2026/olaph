import { z } from "zod";

const uuid = z.string().uuid();
const marker = "OLAPH:1:";

/** QR labels identify a record and its company without exposing a URL or credentials. */
export function materialLabelPayload(tenantId: string, materialId: string) {
  return `${marker}${uuid.parse(tenantId)}:${uuid.parse(materialId)}`;
}

export function supportsCode128(code: string) {
  return /^[\x20-\x7e]{1,64}$/.test(code) && !code.startsWith("OLAPH:");
}
