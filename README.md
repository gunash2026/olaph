# OLAPH

Sunucu ve portal geliştirmesinin güncel kapsamı: [tamamlanma kaydı](docs/COMPLETION-TRACKER.md). Yerel kurulum: [Docker ve API adımları](docs/LOCAL-SETUP.md). Canlı GitHub yayını halen bir önizlemedir.

**Her süreç. Tek, net bir bakış.**

Sektörden bağımsız işletme yönetimi için ilk canlı ürün önizlemesi. Ticari SaaS henüz açılmamıştır; demo verisi yalnızca tarayıcıda saklanır.

- [Canlı önizleme](https://gunash2026.github.io/olaph/tr/)
- [Demo çalışma alanı](https://gunash2026.github.io/olaph/tr/app/)
- [Kalıcı portal önizlemesi](https://gunash2026.github.io/olaph/tr/portal/)
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
pnpm --filter @olaph/web build
```

Web yayını `apps/web/out` dizinidir. GitHub Pages için `NEXT_PUBLIC_BASE_PATH=/olaph` ve `NEXT_PUBLIC_SITE_URL=https://gunash2026.github.io/olaph` kullanılır. Kökte yayında base path boş bırakılır.

## Altyapı

Tam uygulama için [yerel kurulum belgesini](docs/LOCAL-SETUP.md) izleyin. `compose.app.yaml` PostgreSQL, API, Valkey, bildirim işçisi, CMS, Caddy, Mailpit ve virüs taramasını tanımlar. İlk yönetici kurulumu ve migration ayrı işlemlerdir. API, kimlik, işçi ve CMS ayrı veritabanı rollerini kullanır. Tam Compose dağıtım kabulü henüz tamamlanmamıştır.

API `/api/health` ve veritabanı bağlantısını denetleyen `/api/ready` uçlarını sunar. Doğrulanmış e-posta, MFA/passkey, firma kurulumu, davet/roller, katalog/reçete, stok/rezervasyon/sayım/aktarım, malzemeye özel birim dönüşümü, sipariş/ihtiyaç/satın alma, üretim/personel formları ve XLSX akışları eklenmiştir. Valkey/outbox/SMTP teslimi ve CMS yayın yetkileri gerçek servislerle test edilir. Portal arayüzü şu an Türkçedir; tanıtım ve yerel demo beş dildedir.

Kalıcı portal `NEXT_PUBLIC_APP_ENABLED=true` ile aynı origin üzerindeki `/api` servisine bağlanır. GitHub Pages'te bu seçenek kapalıdır; burada hesap veya kalıcı firma verisi tutulmaz. Hosting, alan adı, şirket bilgileri, ödeme hesabı, diğer eksik modüller ve üretim kabulü [tamamlanma kaydında](docs/COMPLETION-TRACKER.md) açık tutulur.

## Yayın ve inceleme

GitHub Actions; tip, domain ve RLS testleri sonrasında statik önizlemeyi yayımlar. Değişiklikler özellik dalı ve PR ile incelenir. İlk PR açık tutulur; canlı önizleme inceleme için kullanılabilir. Gizli anahtarları, `.env` dosyasını veya müşteri verilerini depoya eklemeyin.

`API integration` iş akışı gerçek PostgreSQL/Mailpit/Valkey/CMS kabulünü ve masaüstü/mobil Chromium testlerini çalıştırır. `olaph-browser-report` çıktısı test raporunu ve örnek stok ekranlarını içerir. Güvenlik hattı CodeQL, Gitleaks ve bağımlılık denetimini çalıştırır. Otomatik doğrulama bağımsız sızma testi ve saha pilotunun yerine geçmez.
