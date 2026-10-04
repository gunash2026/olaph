export default function NotFound() {
  return (
    <html lang="tr">
      <body>
        <main className="closing" style={{ minHeight: "100vh" }}>
          <span className="logo">OLΛPH</span>
          <p style={{ marginTop: 60 }}>404</p>
          <h1 style={{ fontSize: 44 }}>Sayfa bulunamadı.</h1>
          <p>Page not found.</p>
          <a
            className="button copper"
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/tr/`}
          >
            OLAPH
          </a>
        </main>
      </body>
    </html>
  );
}
