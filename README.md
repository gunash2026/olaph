# OLAPH

**Her süreç. Tek, net bir bakış.**

Sektörden bağımsız işletme yönetimi için ilk canlı ürün önizlemesi. Ticari SaaS henüz açılmamıştır; demo verisi yalnızca tarayıcıda saklanır.

- [Canlı önizleme](https://gunash2026.github.io/olaph/tr/)
- [Demo çalışma alanı](https://gunash2026.github.io/olaph/tr/app/)
- [Teslim kapsamı ve kalan işler](docs/DELIVERY.md)
- [Mimari](docs/ARCHITECTURE.md)
- [Görsel kaynakları](docs/ASSETS.md)

## Geliştirme

Node.js 22+ ve pnpm 10.32.1 gerektirir.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

`http://localhost:3000/tr/` adresini açın. Desteklenen diller: `tr`, `en`, `ar`, `zh`, `ru`.

```sh
pnpm typecheck
pnpm test
pnpm build
```

Web yayını `apps/web/out` dizinidir. GitHub Pages için `NEXT_PUBLIC_BASE_PATH=/olaph` ve `NEXT_PUBLIC_SITE_URL=https://gunash2026.github.io/olaph` kullanılır. Kökte yayında base path boş bırakılır.

## Altyapı

`.env.example` dosyasını `.env` olarak kopyalayıp yerel parolaları değiştirin. Docker Desktop açıkken `docker compose up -d` yerel PostgreSQL ve Valkey'i başlatır. Veritabanı migration'ı ayrı migration kullanıcısıyla uygulanır; uygulama süper kullanıcı bağlantısını kullanmamalıdır. Bu servisler GitHub Pages üzerinde çalışmaz.

API şu anda `/health` sunar; `/ready` ticari servisler bağlanmadığı için 503 döner. Worker adaptörler yapılandırılmadan iş tüketmez. Kimlik doğrulama, ödeme, e-posta, Excel/AI, CMS ve canlı veritabanı **tamamlanmış değildir**.

## Yayın ve inceleme

GitHub Actions; tip, domain ve RLS testleri sonrasında statik önizlemeyi yayımlar. Değişiklikler özellik dalı ve PR ile incelenir. İlk PR açık tutulur; canlı önizleme inceleme için kullanılabilir. Gizli anahtarları, `.env` dosyasını veya müşteri verilerini depoya eklemeyin.
