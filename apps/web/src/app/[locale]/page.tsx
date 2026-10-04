import { Home } from "@/components/site";
import { getMessages } from "@/lib/translations";
import type { Locale } from "@/lib/config";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <Home locale={locale} t={getMessages(locale)} />;
}
