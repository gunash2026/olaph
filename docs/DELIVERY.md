# OLAPH v0.1 — kapsam ve durum

Bu teslim, 2 Ekim 2026 tarihli briefin **ilk canlı ürün önizlemesidir**. Sürüm 1'in tamamlanmış ticari hizmeti değildir. Briefte yer alan özel firma bilgileri bu depoya taşınmamıştır.

## Çalışan ve yayımlanan

- Next.js, React, TypeScript; pnpm + Turborepo monorepo.
- Türkçe, İngilizce, Arapça (RTL), Çince ve Rusça arayüzler.
- Tanıtım, platform, 6 modül, çözümler, fiyatlandırma, kaynaklar, 3 rehber, yardım, hakkımızda, güvenlik, değişiklik günlüğü, gizlilik bilgilendirmesi ve önizleme koşulları.
- Bakır/grafit tasarım, General Sans, özgün üretim hattı görseli, mobil yerleşim, azaltılmış hareket desteği.
- Cihaza özel demo: malzeme, stok giriş/çıkışı, kritik eşik, sipariş ve durumları, müşteri/tedarikçi, satın alma talebi ve yerel onayı, eksik miktar hesabı, işlem geçmişi, ayarlar.
- UTF-8 CSV önizleme + onaylı içe aktarma ve CSV dışa aktarma; formül enjeksiyonuna karşı hücre kaçışı.
- Ondalık stok hesabı, negatif stok engeli, varsayılan rol matrisi testleri.
- PostgreSQL firma ayrımı için RLS, üyelik kontrolü, firma kapsamlı ilişkiler, NUMERIC alanlar ve silinemez denetim kaydı altyapısı; gerçek PostgreSQL çekirdeği kullanan PGlite üzerinde izolasyon testleri.
- GitHub Actions doğrulama ve GitHub Pages önizleme yayını.

## Temeli eklenen, yayına bağlanmayan

- NestJS API: yalnızca `/health`; `/ready` bilinçli olarak 503 döner. İş uçları açılmaz.
- PostgreSQL migration ve Drizzle temel şema; sunucuda doğrulanmış kimlikten transaction-local firma kapsamı oluşturma.
- BullMQ/Valkey kuyruk üreticisi; dış servis adaptörleri bağlanmadan worker iş tüketmez.
- Yerel PostgreSQL ve Valkey için Docker Compose. Bu teslimde Docker daemon çalışmadığından Compose çalışma testi yapılmamıştır.

## Ticari pilot öncesi kalanlar

1. Better Auth kayıt/davet/oturum, Argon2id, TOTP/passkey, yönetici ve müdür için zorunlu MFA, hız sınırı ve oturum güvenliği.
2. API uçları, sunucuda izin kontrolleri, atomik stok/rezervasyon, işlem tekrarını engelleme, çok seviyeli reçete, depo sahipliği, birim dönüşümü ve kod eşleştirme.
3. ExcelJS dosya/sayfa/sütun eşleme, virüs taraması, yapay zekâ ile öneri ve kullanıcı onayı. Mevcut CSV desteği Excel içe aktarma yerine sayılmaz.
4. Payload CMS, içerik sürümleme, gerçek demo başvurusu, e-posta sağlayıcısı ve spam koruması.
5. iyzico, TCMB kuru, deneme aboneliği, e-fatura. Şu anda ödeme alınmaz ve güncel TL fiyatı iddia edilmez.
6. Canlı PostgreSQL, S3/R2, yedek/PITR, geri yükleme testi, WAF, izleme, sır yönetimi, log saklama ve bağımsız sızma testi.
7. Şirket künyesi, gerçek iletişim kanalları ve profesyonel incelemeden geçmiş yasal metinler. Buradaki önizleme bilgilendirmesi ticari KVKK/DPA/satış sözleşmesinin yerine geçmez.
8. Tüm dillerde ana dili konuşan kişiyle içerik kontrolü, mobil Lighthouse ölçümleri, tüm hedef tarayıcılarda doğrulama, özel alan adları ve arama motoru hesapları.

Üretim, personel, müşteri portalı, sesli asistan, WhatsApp, Logo ve uluslararası ödeme sonraki modüllerdir. Henüz mevcut oldukları izlenimi verilmez.

## Mimari karar

GitHub Pages yalnızca statik dosyaları barındırır. Bu nedenle ilk yayın tanıtım + açıkça işaretlenmiş yerel demodur. Kimlik, ticari veri ve ödeme için ayrı sunucu kurulumu zorunludur. İstemci tarafı demo kayıtları güvenlik, çok kullanıcılı çalışma veya yedek garantisi taşımaz.

Ana dal başlangıç kaydı olarak tutulur; uygulama `feat/initial-platform` dalında PR ile incelemeye açılır. İlk önizleme bu daldan yayımlanabilir; birleşme kullanıcı incelemesine bırakılır.
