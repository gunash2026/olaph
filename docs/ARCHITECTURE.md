# Mimari

`apps/web` statik dışa aktarılan Next.js tanıtım, demo ve portal arayüzüdür. `apps/api` NestJS uygulama API'si, `apps/worker` BullMQ/Valkey bildirim işçisi, `apps/cms` Payload içerik yönetimidir. `packages/database/migrations` veritabanının güncel kaynağıdır; temel Drizzle şeması tüm operasyon tablolarını temsil etmez. `packages/core` ortak doğrulama, hesap ve izin tanımlarını içerir.

Firma verisi tutan her tablo `tenant_id` taşır. Firma içi ilişkiler `(tenant_id, id)` çift anahtarına bağlanır. `olaph_runtime` süper kullanıcı değildir ve RLS atlama yetkisi yoktur. Başlangıç migration'ı ayrı yetkili kullanıcıyla uygulanır; uygulama migration sahibinin bağlantısını kullanamaz. Runtime rolüne giriş ve parola atanması dağıtım sırrı yönetiminde gerçekleştirilir.

Better Auth doğrulanmış e-posta ve sunucu oturumunu yönetir. Parolalar Argon2id ile saklanır; yönetici/onay rollerinde MFA gerekir. Kritik işlemler parola ve TOTP ile beş dakikalık yeniden doğrulama ister. API, istemciden gelen kullanıcı kimliğini kabul etmez; URL'deki firma kimliği aktif üyelikler, rol izinleri ve RLS ile denetlenir. Her işlem transaction içinde `set_config(..., true)` kullanır; havuza dönen bağlantıda firma kapsamı kalmaz.

RLS doğrulaması PGlite üzerinde gerçek SQL ile yapılır: A firmasının B'yi okuma/yazma girişimi, firma kimliğini değiştirme, çapraz firma yabancı anahtarı, yetkisiz güncelleme, denetim kaydını silme ve kimliksiz okuma. Bunlar uygulama kimlik doğrulamasının veya canlı güvenlik denetiminin yerine geçmez.

Çok seviyeli reçetede döngü engellenir. Stok hareketi, depo bakiyesi ve toplam miktar aynı transaction içinde değişir. Tekrarlanan istek anahtarları mükerrer hareket üretmez. Rezervasyon kullanılabilir stoktan ayrılır; serbest bırakma ve tüketme ayrı işlemlerdir. Fiziksel sayım, okunan başlangıç miktarıyla güncel miktarı karşılaştırır; arada stok değişmişse reddedilir. Sayım farkı ve gerekçesi kalıcı kayıttır.

Depo aktarımı aynı sahibin depoları arasında iki karşılıklı hareket oluşturur. Toplam malzeme miktarı değişmez; geçici kritik stok bildirimi üretilmez. Rezerve miktar aktarılamaz. Stoklu deponun sahibi değiştirilemez. İş kayıtları ve üyelik/rol değişiklikleri denetim kaydına yazılır; uygulama rolüne denetim kaydı güncelleme veya silme yetkisi verilmez.

Satın alma kararları onay izni, yakın zamanda kimlik doğrulama ve geçerli abonelik gerektirir. Deneme süresi dolduğunda operasyon yazma uçları engellenir; yetkili okuma ve dışa aktarma sürer. Kullanıcı/rol güvenliği ayrı izinlerle yönetilir. Plan fiyatlandırması ve gerçek ödeme sağlayıcısı henüz bağlı değildir.

Miktarlar `NUMERIC(18,6)`, fiyatlar `NUMERIC(18,4)` olarak saklanır; uygulama taşıma biçimi string'dir. İş hesapları decimal.js kullanır. `Number` yalnızca görünüm biçimlendirmesinde kullanılabilir.

Demo dosyaları tarayıcı yerel depolamasındadır; gerçek API bağlantısı değildir. Denetim geçmişi demo için 500 kayıtla sınırlıdır. Yeni firmada sektör verisi veya hazır malzeme yoktur. Kalıcı portal aynı origin üzerinde `/api` servisine bağlanır; GitHub Pages derlemesinde hesap/veritabanı işlemleri kapalıdır.

XLSX dosyaları boyut/satır sınırı, formül/makro ve ZIP genişleme kontrollerinden geçer. Üretimde ClamAV gerekir. Sayfa ve sütun eşlemesi önizlenir; kullanıcı onayından sonra kaydedilir. AI yalnızca eşleme önerir. Gerçek sağlayıcı kabulü ve şablon belleği tamamlanmamıştır.

Payload beş dil, taslak/yayın, sürüm ve personel rolü kontrolleri içerir. Editör yayıncı yetkisi olmadan içerik yayımlayamaz. İlk yönetici bootstrap komutuyla oluşturulur. CMS içeriğinin tanıtım sitesine bağlanması ve üretim erişim geçidi henüz tamamlanmamıştır.

İş olayları transaction ile outbox'a yazılır. İşçi Valkey kuyruğu, yeniden deneme ve SMTP teslimi kullanır. SMTP tesliminden sonra süreç kesilirse e-posta yinelenebilir; kararlı Message-ID kullanılır ancak tam olarak bir kez teslim garantisi verilmez. İşçi iş tablolarını okuyamaz. Kimlik, API, CMS ve işçi ayrı veritabanı rollerini kullanır.

Caddy statik web ile `/api` yolunu aynı origin altında birleştirir. Sırlar tarayıcı paketine girmez. `compose.app.yaml` yerel servisleri tanımlar; tam konteyner dağıtımı ve üretim yedek/geri yükleme kabulü bekler.

GitHub kabul hattı gerçek PostgreSQL, Mailpit, Valkey ve CMS ile HTTP işlemlerini; Chromium ile masaüstü/mobil kayıt, MFA, firma kurulumu, stok, rol ve ayar akışlarını doğrular. Bu testler üretim güvenlik denetimi, gerçek CAPTCHA/SMTP, cihaz matrisi veya saha pilotu değildir. Güncel sonuçlar ve eksikler [tamamlanma kaydında](COMPLETION-TRACKER.md) tutulur.
