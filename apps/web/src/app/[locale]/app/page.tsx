import { Dashboard } from "@/components/dashboard";
import { getMessages } from "@/lib/translations";
import type { Locale } from "@/lib/config";
export const metadata = {
  title: "OLAPH Demo",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <Dashboard locale={locale} t={getMessages(locale)} />;
}
