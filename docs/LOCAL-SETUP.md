# Yerel sunucu kurulumu

Gerekenler: Node.js 22+, pnpm 10.32.1 ve çalışan Docker. Dış sağlayıcı hesabı gerekmeden e-postalar Mailpit'te tutulur. Gerçek kişilere e-posta gönderilmez.

```powershell
node scripts/setup-local.mjs
docker compose --env-file .env.local-stack -f compose.app.yaml up --build -d
```

Uygulama: http://localhost:8080/tr/portal/ — test e-postaları: http://localhost:8025.

İçerik paneli: http://localhost:3100/admin. İlk CMS yöneticisi açık kayıt ekranından oluşturulmaz. `CMS_ADMIN_EMAIL` ve en az 16 karakterlik `CMS_ADMIN_PASSWORD` değerlerini yerel süreç ortamına veya sır kasasına koyup aşağıdaki komutu çalıştırın. Parolayı komut argümanına yazmayın. Komut mevcut kullanıcı varsa durur; işlem sonunda bu iki ortam değişkenini kaldırın.

```powershell
docker compose --env-file .env.local-stack -f compose.app.yaml run --rm -e CMS_ADMIN_EMAIL -e CMS_ADMIN_PASSWORD cms node node_modules/payload/bin.js run scripts/bootstrap.ts
```

CMS ayrı bir veritabanı rolüyle sadece `cms` şemasını kullanır. Bildirim işçisi sadece outbox tablosuna erişir; API'nin katalog ve kullanıcı tablolarını okuyamaz. Valkey parolalıdır ve dışarı port açmaz. CMS portu yalnızca loopback üzerindedir; canlı ortamda personel erişimi VPN/erişim geçidi, MFA ve HTTPS arkasına alınmalıdır.

İlk kullanıcı kendi e-posta adresini doğrular; boş firma oluşturur; TOTP kurulumunu tamamlar. Katalog ve birimler önceden doldurulmaz. Admin ve manager için MFA zorunludur. Kritik onay ve davetlerde Güvenlik ekranından beş dakikalık yeniden doğrulama yapılır.

Üretim dağıtımı için `.env.local-stack` kullanılmaz. Ayrı sırlar, HTTPS origin, SMTP, Turnstile, virüs taraması, DNS ve yedekleme ayarlanır. PostgreSQL ve kimlik veritabanı adresleri istemci ortam değişkenlerinde bulunamaz. Migration sahibi API'ye verilmez. `.env*` dosyaları Git dışındadır.

Turnstile için `TURNSTILE_SECRET` yalnızca API'ye, `TURNSTILE_SITE_KEY` web derlemesine verilir. Web paketi değişen site anahtarıyla yeniden derlenmelidir. Sunucu tokenı Cloudflare'da doğrular; hostname ve `auth` eylemi eşleşmeden kayıt, giriş ve parola yenileme talebi kabul edilmez. Üretim kurulumunda test anahtarları kullanılmaz. Gerçek site anahtarıyla tarayıcı kabul testi henüz yapılmamıştır.

Geliştirmede yalnızca PostgreSQL ve Mailpit çalıştırmak için:

```powershell
docker compose --env-file .env.local-stack -f compose.app.yaml -f compose.local-test.yaml up -d postgres mailpit
pnpm --filter @olaph/api build
node scripts/local-api.mjs migrate
node scripts/local-api.mjs
```

Bu mod API'yi localhost:4000'de açar. Parolalar günlükte gösterilmez. `compose.local-test.yaml` yalnızca loopback üzerinde PostgreSQL 54320 ve SMTP 1025 portlarını açar; canlı sunucuda kullanılmaz.

Tam dağıtım kabulü; yalnızca servis başlatmanın ötesinde kayıt/doğrulama/MFA, iki ayrı firma ile veri ayrımı, stok ve Excel işlemleri, e-posta teslimatı ve geri yükleme testlerini gerektirir. Kabul sonuçları `COMPLETION-TRACKER.md` içinde tutulur.
