import { z } from "zod";
const uuid = z.string().uuid();

export function parseMaterialLabel(
  value: string,
  tenantId: string,
): { kind: "id"; value: string } | { kind: "code"; value: string } {
  const input = value.trim();
  if (input.startsWith("OLAPH:")) {
    const parts = input.split(":");
    if (
      parts.length !== 4 ||
      parts[1] !== "1" ||
      !uuid.safeParse(parts[2]).success ||
      !uuid.safeParse(parts[3]).success
    )
      throw new Error("INVALID_MATERIAL_LABEL");
    if (parts[2].toLowerCase() !== uuid.parse(tenantId).toLowerCase())
      throw new Error("MATERIAL_LABEL_DIFFERENT_COMPANY");
    return { kind: "id", value: parts[3] };
  }
  if (!input || input.length > 160 || /[\u0000-\u001f\u007f]/.test(input))
    throw new Error("INVALID_MATERIAL_LABEL");
  return { kind: "code", value: input };
}
