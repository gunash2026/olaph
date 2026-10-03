# Güvenlik doğrulama kaydı

3 Ekim 2026: otomatik taramalar bağımsız sızma testi veya ASVS kabulü yerine geçmez.

## Doğrulanan akışlar

Gerçek PostgreSQL ve HTTP entegrasyonu; e-posta doğrulaması, oturum, zorunlu MFA, boş firma kurulumu, başka firmanın verisine erişimin reddi, atomik/idempotent stok, eksi stok reddi, satın alma öncesi tekrar doğrulama ve beş başarısız doğrulamadan sonra geçici kilidi test eder.

## Bağımlılık güncellemeleri

Nodemailer 10.0.14, Sharp 0.35.5, Undici 7.29.1 ve Sass 1.105.1 ile ilk taramadaki yüksek önem dereceli bulgular giderildi. Yerel `pnpm audit --prod --audit-level high` geçti; 2 orta ve 1 düşük bulgu ayrıca izleniyor. Uyarılar yok sayılmadı veya audit eşiği yükseltilmedi.

## Kod taramasında değerlendirme

Dil değiştirme bağlantıları izin verilen beş dile ve URL kodlamasına bağlandı. Portalda firma kimliği URL segmenti olarak kodlanır. Sunucu ayrıca UUID, oturum, üyelik, rol ve RLS kontrolü yapar.

CodeQL `js/insufficient-password-hash` bulgusu, HIBP sızmış parola sorgusundaki SHA-1 hesaplamasını işaretledi. Bu değer parola deposuna yazılmaz veya kimlik doğrulamak için kullanılmaz. HIBP protokolünde yalnızca beş hanelik önek gönderilir; eşleştirme yerelde yapılır. Kayıtlı parolalar Argon2id, 64 MiB bellek, üç geçiş ve rastgele salt ile korunur. Bu bulgu gerekçesi kaydedilmiş bir yanlış pozitiftir; SHA-1 parola saklama amacıyla kullanılmamalıdır.

## Henüz kabul edilmemiş alanlar

Üretim WAF/erişim geçidi, sır kasası, yedek geri yükleme tatbikatı, bağımsız sızma testi, hesap bazlı ilk giriş kilidi, canlı CAPTCHA doğrulaması ve şirket/KVKK incelemesi tamamlanmadan ticari yayına hazır kabul edilmez.
