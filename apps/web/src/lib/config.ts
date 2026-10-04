export const locales = ["tr", "en", "ar", "zh", "ru"] as const;
export type Locale = (typeof locales)[number];
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://gunash2026.github.io/olaph";
export const asset = (name: string) => `${basePath}/${name}`;
export const href = (locale: string, path = "") => {
  const selected = locales.find((candidate) => candidate === locale) || "tr";
  const route = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${basePath}/${selected}/${route ? `${route}/` : ""}`;
};
