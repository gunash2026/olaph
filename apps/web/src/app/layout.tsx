import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "OLAPH — Her süreç. Tek, net bir bakış.",
    template: "%s | OLAPH",
  },
  description:
    "Siparişten teslimata, stoktan tedarike. Sektörden bağımsız işletme yönetim platformu.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
