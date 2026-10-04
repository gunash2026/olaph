import { Portal } from "@/components/portal";
import type { Locale } from "@/lib/config";
export const metadata = {
  title: "OLAPH · Çalışma alanı",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <Portal locale={locale} />;
}
