import { href } from "@/lib/config";
export default function Index() {
  return (
    <html lang="tr">
      <head>
        <meta httpEquiv="refresh" content={`0;url=${href("tr")}`} />
      </head>
      <body>
        <a href={href("tr")}>OLAPH · Türkçe</a>
      </body>
    </html>
  );
}
