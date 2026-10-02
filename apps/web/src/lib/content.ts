import type { Locale } from "./config";
export const copy: Record<
  Locale,
  {
    status: string;
    scope: string;
    security: string;
    privacy: string;
    terms: string;
    about: string;
    contact: string;
    models: string[];
    roles: string[];
    guides: string[];
    guideText: string[];
    roadmap: string;
    change: string;
  }
> = {
  tr: {
    status: "Ürün önizlemesi · v0.1",
    scope:
      "Bu yayın, tasarım ve iş akışlarını denemeniz için hazırlanmış bir önizlemedir. Gerçek firma hesabı, ödeme, e-posta ve sunucuya veri kaydı henüz açılmamıştır.",
    security:
      "Üretim mimarisi PostgreSQL satır düzeyi güvenlik, firma kapsamlı anahtarlar ve işlem bazında yetkilendirme üzerine kurulmaktadır. Bu önizlemede oturum açılmaz; tüm demo işlemleri tarayıcıda gerçekleşir. Bağımsız sızma testi, yedek geri yükleme tatbikatı ve canlı altyapı kontrolleri tamamlanmadan gerçek firma verisi kabul edilmeyecektir.",
    privacy:
      "Bu önizlemede reklam, analiz veya pazarlama takibi çalıştırılmaz. Demo alanına girdiğiniz bilgiler tarayıcınızın yerel depolamasında tutulur; uygulama tarafından bir sunucuya gönderilmez. Sıfırla düğmesiyle silebilir veya CSV olarak indirebilirsiniz. Siteyi sunan GitHub, normal bağlantı ve erişim kayıtlarını kendi politikası kapsamında işleyebilir. Gerçek kişi, müşteri ve ticari sır bilgisi girmeyin.",
    terms:
      "Önizleme ücretsizdir; abonelik veya satış sözleşmesi oluşturmaz. Demo verileri güvenilir bir iş kaydı yerine kullanılamaz ve cihaz temizlendiğinde kaybolabilir. Gösterilen paketler planlama amaçlıdır. Ticari hizmet koşulları, şirket künyesi ve diğer yasal metinler hizmet açılmadan önce ayrıca yayımlanacaktır.",
    about:
      "OLAPH, sipariş, stok ve tedarik süreçlerini aynı yerde görünür kılmak için geliştiriliyor. Temel yaklaşımımız, sektör kalıpları yerine her işletmenin kendi malzemelerini, birimlerini ve akışını tanımlamasıdır. Modüller, sahada doğrulanarak sırayla devreye alınacaktır.",
    contact:
      "Bu aşamada iletişim veya deneme başvurusu toplanmıyor. Proje hakkındaki geri bildirimlerinizi GitHub deposundaki Issues alanında paylaşabilirsiniz. Herkese açık paylaşımlarda kişisel veya ticari gizli bilgi kullanmayın.",
    models: [
      "Fason üretim",
      "Siparişe üretim",
      "Stoka üretim",
      "Çok tesisli çalışma",
    ],
    roles: ["Yönetici", "Muhasebe", "Üretim sorumlusu"],
    guides: [
      "Stok takibine temiz bir başlangıç",
      "Siparişten malzeme ihtiyacına",
      "Satın almada onay akışı",
    ],
    guideText: [
      "Önce kendi malzemelerinizi kod ve birimleriyle tanımlayın. Başlangıç miktarını fiziksel sayımla doğrulayın. Sonraki giriş ve çıkışları hareket olarak kaydedin; stok bakiyesini göz kararı değiştirmeyin. Kritik eşik, malzemenin teslim süresi ve tüketimine göre işletmenizce belirlenir.",
      "İhtiyaç listesi, siparişte gereken miktarla kullanılabilir stoğun karşılaştırılmasıdır. Bu demoda malzeme ve toplam ihtiyaç miktarını siz seçersiniz. Otomatik çok seviyeli reçete çözümleme ve Excel sipariş eşleme sonraki sürümlerde bağlanacaktır.",
      "Önce talebi oluşturun, miktarı ve tedarikçiyi kontrol edin, ardından yetkili kişinin onayından geçirin. Bu demoda onay işlemi yalnızca yerel kaydı günceller. Tedarikçiye sipariş veya ileti göndermez.",
    ],
    roadmap:
      "Bu modül yol haritasında. Önce katalog, stok ve sipariş temeli sahada doğrulanacak; ardından üretim, personel ve raporlama derinleştirilecek.",
    change:
      "İlk önizleme: 5 dilde tanıtım sitesi, boş başlangıçlı demo çalışma alanı, katalog, stok hareketleri, sipariş, iş ortakları, satın alma talepleri ve CSV içe/dışa aktarma.",
  },
  en: {
    status: "Product preview · v0.1",
    scope:
      "This release is a preview of the design and workflows. Company accounts, payments, email and server-side data storage are not enabled.",
    security:
      "The production architecture is being built around PostgreSQL row-level security, tenant-scoped keys and action-level permissions. This preview has no sign-in; demo activity takes place in the browser. Real business data will only be accepted after independent security testing, backup restore drills and infrastructure verification.",
    privacy:
      "This preview uses no advertising, analytics or marketing trackers. Demo records stay in local storage in your browser and are not sent to an application server. You can delete them with Reset or export CSV. GitHub, which serves this website, may process connection logs under its own policy. Do not enter personal or confidential business information.",
    terms:
      "This free preview does not create a subscription or sales agreement. Demo data is not a reliable business record and can be lost when your device is cleared. Plans shown are proposals. Commercial terms, company details and legal documents will be published before service activation.",
    about:
      "OLAPH is being developed to bring orders, inventory and purchasing into one clear view. Instead of industry templates, each business defines its own materials, units and workflows. Modules will be rolled out following real-world validation.",
    contact:
      "Contact or trial applications are not collected at this stage. Share feedback in the GitHub repository’s Issues section. Do not include personal or confidential business information in public submissions.",
    models: [
      "Contract manufacturing",
      "Make to order",
      "Make to stock",
      "Multi-site operations",
    ],
    roles: ["Manager", "Accounting", "Production lead"],
    guides: [
      "A clean start for inventory",
      "From orders to requirements",
      "Approvals in purchasing",
    ],
    guideText: [
      "Define your materials with unique codes and units. Verify opening balances through a physical count. Record subsequent receipts and issues as movements. Set each low-stock threshold based on your consumption and supplier lead time.",
      "A requirements list compares demand with available stock. In this demo, select a material and enter total demand. Automatic multi-level bill-of-material calculations and Excel order mapping will be integrated in later releases.",
      "Create a request, check quantity and supplier, then obtain an authorized approval. Approval in this demo only updates a local record. It does not send an order or message to any supplier.",
    ],
    roadmap:
      "This module is on the roadmap. Catalog, inventory and order workflows will be validated first, followed by production, people and deeper reporting.",
    change:
      "First preview: website in 5 languages, an empty demo workspace, catalog, stock movements, orders, partners, purchasing requests and CSV import/export.",
  },
  ar: {
    status: "معاينة المنتج · v0.1",
    scope:
      "هذا الإصدار معاينة للتصميم وسير العمل. حسابات الشركات والدفع والبريد وحفظ البيانات على الخادم غير متاحة.",
    security:
      "تعتمد البنية المخططة على أمان الصفوف في PostgreSQL وعزل الشركات والصلاحيات لكل عملية. لا يوجد تسجيل دخول في المعاينة؛ تجري العمليات في المتصفح. يسبق قبول البيانات الحقيقية اختبار أمني مستقل وتجربة استعادة النسخ الاحتياطية.",
    privacy:
      "لا تستخدم المعاينة تتبع الإعلانات أو التحليلات. تحفظ البيانات محلياً في المتصفح ولا ترسل إلى خادم التطبيق. يمكن حذفها أو تصدير CSV. قد تعالج GitHub سجلات الاتصال وفق سياستها. لا تدخل معلومات حقيقية أو سرية.",
    terms:
      "هذه معاينة مجانية وليست اشتراكاً أو عقد بيع. قد تضيع البيانات عند مسح الجهاز. الباقات المعروضة مقترحة. تنشر الشروط التجارية والوثائق القانونية قبل تفعيل الخدمة.",
    about:
      "تجمع OLAPH الطلبات والمخزون والمشتريات في رؤية واحدة. تحدد كل شركة موادها ووحداتها وعملياتها دون قوالب قطاعية. تطلق الوحدات بعد التحقق الميداني.",
    contact:
      "لا نجمع طلبات تواصل أو تجربة حالياً. شارك ملاحظاتك عبر Issues في مستودع GitHub دون بيانات شخصية أو سرية.",
    models: [
      "التصنيع التعاقدي",
      "التصنيع حسب الطلب",
      "التصنيع للمخزون",
      "العمل متعدد المواقع",
    ],
    roles: ["المدير", "المحاسبة", "مسؤول الإنتاج"],
    guides: [
      "بداية واضحة للمخزون",
      "من الطلب إلى الاحتياج",
      "الموافقة على المشتريات",
    ],
    guideText: [
      "عرّف المواد برموز ووحدات فريدة وتحقق من الرصيد بالجرد. سجّل الإدخالات والإخراجات كحركات. حدد حدود التنبيه حسب الاستهلاك ومدة التوريد.",
      "تقارن قائمة الاحتياجات الطلب بالمخزون. في التجربة تختار المادة والكمية المطلوبة. تضاف حسابات الوصفات متعددة المستويات وربط Excel لاحقاً.",
      "أنشئ الطلب وتحقق من الكمية والمورد ثم الموافقة. الموافقة التجريبية تغير السجل المحلي فقط ولا ترسل طلباً إلى المورد.",
    ],
    roadmap:
      "هذه الوحدة مخططة. يتم التحقق من المخزون والطلبات أولاً ثم الإنتاج والموظفين والتقارير.",
    change:
      "المعاينة الأولى: خمس لغات، مساحة عمل فارغة، كتالوج ومخزون وطلبات وشركاء ومشتريات واستيراد وتصدير CSV.",
  },
  zh: {
    status: "产品预览 · v0.1",
    scope:
      "此版本用于预览设计和业务流程。企业账户、支付、邮件和服务器存储尚未开放。",
    security:
      "正式架构以 PostgreSQL 行级安全、企业隔离及操作权限为基础。预览无需登录，演示在浏览器中运行。接受真实数据前需完成独立安全测试、备份恢复及基础设施验证。",
    privacy:
      "此预览不使用广告或分析追踪。演示数据存于浏览器，不发送至应用服务器。可重置或导出 CSV。GitHub 可能按其政策处理访问记录。请勿输入真实或保密信息。",
    terms:
      "免费预览不构成订阅或销售协议。设备清理可能导致演示数据丢失。所示套餐为规划方案，商业条款和法律文件将在服务开放前发布。",
    about:
      "OLAPH 将订单、库存及采购集中展示。每家企业可定义自己的物料、单位和流程，不受行业模板限制。模块将经实际验证后逐步推出。",
    contact:
      "目前不收集联系或试用申请。请通过 GitHub 仓库 Issues 提交反馈，不要包含个人或商业机密。",
    models: ["合同制造", "按订单生产", "备货生产", "多工厂运营"],
    roles: ["管理者", "财务", "生产负责人"],
    guides: ["清晰的库存起点", "从订单到物料需求", "采购审批流程"],
    guideText: [
      "使用唯一编码和单位定义物料，通过实物盘点核对初始库存。之后以库存变动记录入库和出库。根据消耗及供货时间确定预警阈值。",
      "物料需求表对比需求与库存。演示中自行选择物料并输入总需求，多级物料清单计算和 Excel 订单匹配将在后续集成。",
      "创建申请并核对数量及供应商，然后获得批准。演示审批仅更改本地记录，不向供应商发送任何订单。",
    ],
    roadmap: "此模块在规划中。先验证目录、库存与订单，再扩展生产、人员和报表。",
    change:
      "首次预览：五种语言网站、空白演示工作区、目录、库存变动、订单、合作伙伴、采购申请和 CSV 导入导出。",
  },
  ru: {
    status: "Предпросмотр · v0.1",
    scope:
      "Это предварительная версия дизайна и процессов. Аккаунты компаний, оплата, почта и хранение на сервере пока не включены.",
    security:
      "Архитектура строится на защите строк PostgreSQL, изоляции компаний и правах операций. В демо нет входа; всё работает в браузере. Реальные данные будут приниматься после независимого тестирования безопасности и проверки восстановления резервных копий.",
    privacy:
      "Здесь нет рекламного или аналитического отслеживания. Данные остаются в браузере и не передаются серверу приложения. Их можно удалить или выгрузить в CSV. GitHub может обрабатывать журналы соединений по своей политике. Не вводите личные или секретные данные.",
    terms:
      "Бесплатная предварительная версия не создаёт подписку или договор продажи. Данные могут исчезнуть при очистке устройства. Тарифы являются предложением. Коммерческие условия и юридические документы будут опубликованы до запуска услуг.",
    about:
      "OLAPH объединяет заказы, склад и закупки. Каждая компания определяет свои материалы, единицы и процессы без отраслевых шаблонов. Модули будут внедряться после практической проверки.",
    contact:
      "Заявки на связь или пробный доступ пока не собираются. Отзывы можно оставить в Issues репозитория GitHub. Не публикуйте личные или конфиденциальные данные.",
    models: [
      "Контрактное производство",
      "Производство под заказ",
      "Производство на склад",
      "Несколько площадок",
    ],
    roles: ["Руководитель", "Бухгалтерия", "Начальник производства"],
    guides: [
      "Чистый старт складского учёта",
      "От заказа к потребностям",
      "Согласование закупок",
    ],
    guideText: [
      "Задайте материалы с уникальными кодами и единицами. Проверьте начальные остатки инвентаризацией. Записывайте приход и расход как движения. Определите пороги по потреблению и срокам поставки.",
      "Потребности сравнивают спрос с остатками. В демо выберите материал и введите спрос. Многоуровневые спецификации и сопоставление Excel будут добавлены позже.",
      "Создайте заявку, проверьте количество и поставщика, затем согласуйте. Демо-согласование меняет только локальную запись и не отправляет заказ поставщику.",
    ],
    roadmap:
      "Модуль запланирован. Сначала будут проверены каталог, склад и заказы, затем производство, персонал и отчётность.",
    change:
      "Первый предпросмотр: 5 языков, пустое рабочее пространство, каталог, движения запасов, заказы, партнёры, закупки и CSV.",
  },
};
