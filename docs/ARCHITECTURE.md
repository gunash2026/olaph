# Mimari

`apps/web` statik dışa aktarılabilen Next.js arayüzüdür. `packages/core` veri doğrulama, ondalık hesap ve izin sözlüğünü paylaşır. `apps/api` NestJS modüler monolit başlangıcıdır. `packages/database` SQL migration ve Drizzle şemasını içerir. `apps/worker` BullMQ/Valkey adaptör sınırıdır.

Firma verisi tutan her tablo `tenant_id` taşır. Firma içi ilişkiler `(tenant_id, id)` çift anahtarına bağlanır. `olaph_runtime` süper kullanıcı değildir ve RLS atlama yetkisi yoktur. Başlangıç migration'ı ayrı yetkili kullanıcıyla uygulanır; uygulama migration sahibinin bağlantısını kullanamaz. Runtime rolüne giriş ve parola atanması dağıtım sırrı yönetiminde gerçekleştirilir.

`withTenant` yalnızca doğrulanmış sunucu oturumundan gelen kimliği kabul edecek sözleşmeyle tasarlanmıştır. İstek gövdesi veya `X-Tenant-Id` gibi istemci başlıkları kimlik kaynağı değildir. Her işlem tek transaction içinde `set_config(..., true)` kullanır; havuza dönen bağlantıda firma kapsamı kalmaz.

RLS doğrulaması PGlite üzerinde gerçek SQL ile yapılır: A firmasının B'yi okuma/yazma girişimi, firma kimliğini değiştirme, çapraz firma yabancı anahtarı, yetkisiz güncelleme, denetim kaydını silme ve kimliksiz okuma. Bunlar uygulama kimlik doğrulamasının veya canlı güvenlik denetiminin yerine geçmez.

SQL migration ilk katalog/stok/sipariş ilişkilerini gösterir. Reçete şu an yalnızca ürün–malzeme bağlantısıdır; çok seviyeli reçete ve döngü engeli tamamlanmamıştır. Stok hareketi ile bakiyenin atomik güncellemesi, satın alma onayında adım yükseltme ve yetki kontrolü, kullanıcı yönetimi, mali alanlar için ayrı erişim yüzeyi canlı API'den önce tamamlanmalıdır.

Miktarlar `NUMERIC(18,6)`, fiyatlar `NUMERIC(18,4)` olarak saklanır; uygulama taşıma biçimi string'dir. İş hesapları decimal.js kullanır. `Number` yalnızca görünüm biçimlendirmesinde kullanılabilir.

Demo dosyaları tarayıcı yerel depolamasındadır; gerçek API bağlantısı değildir. Denetim geçmişi demo için 500 kayıtla sınırlıdır; sunucu denetim kaydı append-only olacak şekilde tasarlanmıştır. Yeni firmada sektör verisi veya hazır malzeme yoktur.
