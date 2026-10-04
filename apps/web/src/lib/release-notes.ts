import type { Locale } from "./config";

export const latestRelease: Record<
  Locale,
  { title: string; items: string[]; scope: string; link: string }
> = {
  tr: {
    title: "Kalıcı çalışma alanı ve stok kontrolü",
    items: [
      "QR ve Code 128 malzeme etiketleri: PNG indirme, yazdırma, okuyucu veya görselle arama ve bulunan malzemeden stok işlemine geçiş.",
      "Doğrulanmış hesap, iki aşamalı doğrulama, firma kurulumu, ekip davetleri ve özelleştirilebilir roller.",
      "Stok sayımı, depolar arası aktarım ve rezervasyon. Yinelenen işlemler ve çakışan sayımlar için kontroller.",
      "Malzemeye özel birim dönüşümleri: paket, levha veya başka birimle giriş/çıkış; geçmişte girilen miktar, katsayı ve stok birimi birlikte saklanır.",
      "Masaüstü ve mobil tarayıcıda kayıt, giriş, stok, rol ve ayar akışlarının doğrulanması.",
    ],
    scope:
      "Bu özellikler geliştirme ve kabul ortamında çalışıyor. GitHub yayını önizlemedir; gerçek şirket hesapları ve sunucu kurulumu henüz hizmete açılmadı. Ticari sürüm ve briefin kalan kapsamı üzerinde çalışma sürüyor.",
    link: "Geliştirme ve doğrulama kaydı",
  },
  en: {
    title: "Persistent workspace and inventory controls",
    items: [
      "QR and Code 128 material labels: PNG downloads, printing, scanner or image lookup and stock entry from the matched material.",
      "Verified accounts, two-factor authentication, company setup, team invitations and custom roles.",
      "Physical stock counts, warehouse transfers and reservations, with checks for duplicate requests and conflicting counts.",
      "Material-specific unit conversions for stock receipts and issues, preserving the entered quantity, conversion factor and stock unit in each movement.",
      "Desktop and mobile browser verification of signup, sign-in, inventory, roles and settings.",
    ],
    scope:
      "These features run in development and acceptance environments. The GitHub site remains a preview; hosted company accounts are not open. Work continues on the commercial release and the remaining project scope.",
    link: "Development and verification record",
  },
  ar: {
    title: "مساحة عمل دائمة وضبط المخزون",
    items: [
      "ملصقات مواد QR وCode 128: تنزيل PNG والطباعة والبحث بالقارئ أو الصورة وفتح حركة مخزون للمادة المطابقة.",
      "حسابات موثقة، مصادقة ثنائية، إنشاء شركة، دعوات للفريق وأدوار قابلة للتخصيص.",
      "جرد فعلي، نقل بين المستودعات وحجز المخزون، مع منع تكرار الطلبات وتعارض الجرد.",
      "تحويل الوحدات لكل مادة عند الاستلام والصرف، مع حفظ الكمية المدخلة ومعامل التحويل ووحدة المخزون في سجل الحركة.",
      "التحقق من التسجيل والدخول والمخزون والأدوار والإعدادات في متصفح الحاسوب والهاتف.",
    ],
    scope:
      "تعمل هذه الميزات في بيئات التطوير والاختبار. موقع GitHub ما زال معاينة؛ حسابات الشركات المستضافة غير متاحة بعد. يستمر العمل على النسخة التجارية وبقية نطاق المشروع.",
    link: "سجل التطوير والتحقق",
  },
  zh: {
    title: "持久化工作区与库存控制",
    items: [
      "物料二维码与 Code 128 标签：下载 PNG、打印、通过扫码器或图片查找，并为匹配物料创建库存流水。",
      "已验证账户、双重身份验证、企业创建、团队邀请及自定义角色。",
      "实物盘点、仓库调拨和库存预留，检查重复请求与盘点冲突。",
      "按物料定义入库和出库的单位换算，并在每笔库存流水中保留输入数量、换算系数及库存单位。",
      "在桌面和手机浏览器中验证注册、登录、库存、角色和设置流程。",
    ],
    scope:
      "这些功能运行于开发和验收环境。GitHub 网站仍为预览，尚未开放托管企业账户。商业版本及项目剩余范围仍在开发中。",
    link: "开发与验证记录",
  },
  ru: {
    title: "Постоянное рабочее пространство и контроль запасов",
    items: [
      "Этикетки материалов QR и Code 128: загрузка PNG, печать, поиск сканером или по изображению и создание складской операции для найденного материала.",
      "Подтверждённые аккаунты, двухфакторная аутентификация, создание компании, приглашения и настраиваемые роли.",
      "Инвентаризация, перемещения между складами и резервирование с защитой от повторных запросов и конфликтов пересчёта.",
      "Пересчёт единиц для каждого материала при поступлении и списании с сохранением введённого количества, коэффициента и складской единицы в истории.",
      "Проверка регистрации, входа, запасов, ролей и настроек в настольном и мобильном браузерах.",
    ],
    scope:
      "Эти функции работают в средах разработки и приёмки. Сайт GitHub остаётся предпросмотром; размещённые аккаунты компаний пока не открыты. Коммерческий выпуск и остальной объём проекта находятся в разработке.",
    link: "Ход разработки и результаты проверок",
  },
};
