# ADR 0001 — Çalışma zamanı ve veri sınırları

Durum: uygulanıyor. Son doğrulama tamamlanmadan üretim kabulü değildir.

Tanıtım sitesi Next.js statik çıktısı olarak GitHub Pages'te çalışır. Gerçek portal aynı kaynak kodundan `NEXT_PUBLIC_APP_ENABLED=true` ile derlenir ve Nest API ile aynı origin üzerinden sunulur. Pages sürümü gerçek hesap açmaz; iki ortamın verisi karıştırılmaz.

Kimlik doğrulama Better Auth'tadır. E-posta doğrulaması, Argon2id, TOTP ve passkey yapılandırılır. Firma ve izin bilgisi tarayıcının gönderdiği kullanıcı kimliğinden üretilmez; doğrulanmış sunucu oturumundan alınır. İsteklerdeki firma UUID'si yalnızca seçimdir ve üyelikle tekrar kontrol edilir.

PostgreSQL rollerinin sınırları:

- Migration sahibi yalnızca ayrı kurulum işi sırasında kullanılır.
- `olaph_login`, `olaph_runtime` izinlerini devralır; superuser veya BYPASSRLS olamaz.
- `olaph_auth` yalnızca kimlik şemasının sahibidir.
- İşçi yalnızca outbox okuma/güncelleme iznine sahip ayrı rol kullanır.
- Payload, operasyon tablolarından ayrı `cms` şemasında çalışır; personel, stok veya sipariş tablolarının sahibi değildir.

Kullanıcı ve firma bağlamı transaction-local ayarlanır. Havuz bağlantısı bırakılmadan commit/rollback yapılır. Her tablo için RLS ve bileşik firma/yabancı anahtarlar uygulanır. Ayrıcalıklı SQL fonksiyonları sabit search_path, açık yetki kontrolü ve PUBLIC erişiminin kaldırılmasıyla sınırlandırılır.

Miktarlar `NUMERIC(18,6)`, fiyatlar `NUMERIC(18,4)` tutulur. Stok doğrudan bakiye düzenlemesiyle değiştirilmez. Hareket eklenmesi ile depo ve toplam bakiye güncellemesi aynı transaction'dadır. Tekrarlanan istek anahtarı ikinci hareket oluşturmaz. Rezervasyon kullanılabilir stoğu azaltır; müşteri sahipliği korunur.

Reçete grafiğine ekleme firma bazında kilitlenir ve dolaylı döngüler reddedilir. Excel satırları önce geçici önizleme kaydıdır. Eşleme doğrulanmadan ve kullanıcı onayı alınmadan sipariş veya ihtiyaç kaydı eklenmez. Katalogda bulunmayan kodlar otomatik oluşturulmaz.

Kuyruk teslimatı en az bir kez semantiğindedir. SMTP kabulünden hemen sonra işçi çökerse aynı ileti tekrar gönderilebilir; Message-ID sabittir. Ödeme ve iş verisi mutasyonlarında ayrıca idempotent anahtar zorunludur. AI bir öneri üretir; kayıt veya finansal onay veremez.

Özel dağıtım aynı servisleri kullanır. Canlı yedek/geri yükleme, bağımsız güvenlik testi, hukuk incelemesi ve pilot kabulü ayrı doğrulama adımlarıdır.
