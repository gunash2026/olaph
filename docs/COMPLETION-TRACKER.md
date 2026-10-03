# OLAPH — briefin tamamlanma kaydı

Ana kapsam, 2 Ekim 2026 tarihli kullanıcı briefinin tamamıdır. Canlı tanıtım ve yerel demo, bu kapsamın tamamlanması değildir. Bir madde yalnızca kod, ilgili test ve gerekli canlı doğrulama birlikte tamamlandıysa tamamlanmış sayılır.

Durumlar: `hazır` (doğrulandı), `uygulanıyor`, `bekliyor`, `dış erişim / insan doğrulaması gerekli`.

| Kapsam                                                   | Durum                                  | Tamamlanma kanıtı / eksik                                                                   |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| T0: kapsam, süreç, veri modeli, roller, sözlük, kararlar | uygulanıyor                            | ADR ve model var; kapsam matrisi genişletiliyor                                             |
| T1: kimlik, tasarım sistemi, senaryo, hareket            | uygulanıyor                            | Beş dil ve mobil tasarım hazır; tam kaydırma senaryosu eksik                                |
| T2.1: depo, test ve yayın                                | hazır                                  | PR #1, CI ve Pages başarılı                                                                 |
| T2.2: PostgreSQL firma ayrımı                            | uygulanıyor                            | RLS testleri hazır; kalıcı canlı PostgreSQL bağlantısı gerekli                              |
| T2.3: kayıt, giriş, doğrulama, davet, MFA                | uygulanıyor                            | Better Auth + sunucu oturumu                                                                |
| T2.4: özelleştirilebilir roller ve izinler               | uygulanıyor                            | Sunucu + SQL denetimi, tüm iş uçları                                                        |
| T2.5: kalıcı denetim kaydı                               | uygulanıyor                            | Değişmez SQL kaydı temeli; kullanıcı ve yönetim işlemleri eklenecek                         |
| T2.6: yedek, geri yükleme, izleme                        | bekliyor                               | Canlı sunucu erişimi ve gerçek geri yükleme tatbikatı                                       |
| T2.7: ASVS ve bağımsız sızma testi                       | dış erişim / insan doğrulaması gerekli | Otomatik test, bağımsız denetim yerine geçmez                                               |
| T3: tüm tanıtım / kaynak / yardım / hata sayfaları       | uygulanıyor                            | Temel sayfalar var; CMS, blog, RSS, kapsamlı yasal sayfalar eksik                           |
| T3: demo/iletişim formları                               | bekliyor                               | Gerçek kayıt, e-posta ve spam koruması                                                      |
| T3: SEO, erişilebilirlik, performans                     | uygulanıyor                            | Statik HTML, hreflang, sitemap ve bağlantı denetimi var; Lighthouse / cihaz matrisi gerekli |
| T4: firma kurulumu, üyeler, roller, ayarlar              | uygulanıyor                            | Gerçek sunucuya bağlı portal                                                                |
| M1: katalog, çok seviyeli reçete, stok, depo, sahiplik   | uygulanıyor                            | Atomik stok, rezervasyon, birim dönüşümü, kod eşleme, sayım ve barkod                       |
| Excel / AI belge işleme                                  | uygulanıyor                            | Dosya → sayfa → eşleme → önizleme → onay; virüs taraması ve sağlayıcı bağlantısı            |
| Sipariş, ihtiyaç, tedarik, onay                          | uygulanıyor                            | Sunuculu işlem bütünlüğü ve müşteri/tedarikçi ayrımları                                     |
| Bildirim, e-posta ve kuyruklar                           | bekliyor                               | SMTP, olay/outbox ve yeniden deneme                                                         |
| Abonelik, iyzico, TCMB, faturalar                        | bekliyor                               | Gerçek satıcı hesabı ve entegratör erişimi gerekli                                          |
| Payload CMS ve OLAPH yönetimi                            | bekliyor                               | İçerik, firma, paket, başvuru ve sürüm yönetimi                                             |
| M2: üretim, istasyon, iş emri ve kalite                  | bekliyor                               | Pilot kabul kriterleri dahil                                                                |
| M3: müşteri portalı, teslimat, şikayet                   | bekliyor                               | Müşteriye özel veri görünürlüğü                                                             |
| M4: personel, vardiya ve belgeler                        | bekliyor                               | KVKK yetkileri ve saklama politikası                                                        |
| M5: raporlar, PDF/Excel dışa aktarma                     | bekliyor                               | Firma kapsamlı gerçek veri                                                                  |
| Sesli asistan, WhatsApp, Logo ve dış ödemeler            | bekliyor                               | Sağlayıcı adaptörleri + gerçek hesaplar + insan onaylı iş akışı                             |
| Docker ve şirket sunucusuna kurulum                      | uygulanıyor                            | Aynı kod, izole servisler, sırlar, migration ve sağlık kontrolleri                          |
| 17 yasal metin / kayıt, künye, İYS, ETBİS/VERBİS         | dış erişim / insan doğrulaması gerekli | Şirket bilgileri ve avukat/mali müşavir değerlendirmesi                                     |
| Alan adları, DNS, SPF/DKIM/DMARC, arama motoru kayıtları | dış erişim / insan doğrulaması gerekli | Hesap/alan adı erişimi; ücretli satın alma ayrıca kararlaştırılır                           |
| Pilot ve farklı sektör doğrulaması                       | dış erişim / insan doğrulaması gerekli | Gerçek firma verileri ve sahadaki kullanıcı kabulü                                          |

Tamamlanmamış maddeler, takvim veya harcanan süre nedeniyle kapatılmaz. Entegrasyonun ayar ekranının bulunması, gerçek entegrasyonun çalıştığı anlamına gelmez.

## 3 Ekim 2026 geliştirme kaydı

Sunucu ve alan adı kullanıcıda henüz bulunmuyor. Şirket unvanı, adresi ve destek e-postası da henüz hazır değil; ticari ve yasal bilgiler uydurulmaz. GitHub Pages tanıtım/önizleme ortamıdır; PostgreSQL, Better Auth veya işçi süreci burada çalıştırılamaz.

Eklenen kod: Better Auth doğrulama/MFA/passkey, firma oluşturma ve 14 günlük deneme, dört rol ve özelleştirilebilir izinler, süreli davet, yakın zamanda yeniden doğrulama, kalıcı katalog/sipariş/stok API'si, depo bakiyesi ve rezervasyon, çok seviyeli reçete ve döngü kontrolü, satın alma onayı, üretim/kalite/personel tabloları ve formları, XLSX tarama/eşleme/önizleme/onay/dışa aktarma, SMTP outbox işçisi ve salt öneri üreten AI eşleme uç noktası.

Payload CMS kaynakları beş dil, taslak/yayın, sürüm geçmişi, yayıncı yetkisi, içerik/plan/durum koleksiyonlarıyla eklendi. CMS'nin canlı editör kabulü henüz yapılmadı. Yeni portal arayüzü şu anda Türkçedir; diğer dört dilin portal çevirileri tamamlanmış değildir.

Yerel doğrulama: 35 Vitest testi başarılı. Web ve Payload CMS üretim derlemeleri tamamlandı. 119 HTML sayfasında bağlantı, varlık ve ana başlık kontrolü geçti; portalın mobil önizlemesi tarayıcıda incelendi. Gerçek PostgreSQL + Mailpit + HTTP oturum/MFA/stok testi için `api-integration.yml` eklendi; başarılı çalıştırma sonucu gelmeden bu akış doğrulanmış sayılmaz.

Yerel Docker indirmesi EOF ile kesildi ve 8 GB bellek üzerinde doğrulama işlerini yavaşlattı; Docker kapatıldı, ardından 35 test geçti. `compose.app.yaml` kurulum tarifi henüz uçtan uca kabul edilmiş değildir. Kuyruk, CMS, ödeme, objekt depolama, pilot ve üretim güvenliği için ayrı doğrulama gereklidir.

GitHub doğrulaması: [0576492 gerçek API testi](https://github.com/gunash2026/olaph/actions/runs/37133419740) ve [tam derleme/test hattı](https://github.com/gunash2026/olaph/actions/runs/37133419702) geçti. Portal önizlemesi yayımlandı. Sonraki değişiklikte Valkey/SMTP bildirim teslimi ve CMS yayıncı yetkileri entegrasyon testine eklendi; bu eklerin sonuçları ayrıca takip ediliyor. CMS migration, korumalı ilk yönetici kurulumu, SMTP adaptörü ve Docker servisleri eklendi. Güncel güvenlik bulguları `SECURITY-VALIDATION.md` içinde tutuluyor.
