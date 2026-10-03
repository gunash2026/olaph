import { test, expect, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";

const password = "Browser-test-only-password-2026!";
const mail = process.env.TEST_MAIL_URL || "http://127.0.0.1:8025";
if (!["localhost", "127.0.0.1"].includes(new URL(mail).hostname))
  throw Error("Mailpit must be local.");

function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replaceAll("=", "").toUpperCase()]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(
    (bits.match(/.{8}/g) || []).map((x) => parseInt(x, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return String(
    (hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000,
  ).padStart(6, "0");
}
async function section(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Çalışma alanı", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Kaydedildi.");
}

test("verified signup, MFA, inventory, role settings and persistent session", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  const email = `browser-${randomUUID()}@example.test`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tr/portal/");
  await page
    .getByRole("button", { name: "Hesap oluştur", exact: true })
    .click();
  await page.getByLabel("Ad soyad", { exact: true }).fill("Tarayıcı Testi");
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Kayıt ol", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Doğrulama bağlantısı");

  let messageId = "";
  await expect
    .poll(async () => {
      const inbox = await (await request.get(`${mail}/api/v1/messages`)).json();
      messageId =
        inbox.messages?.find(
          (item: { ID: string; To: { Address: string }[] }) =>
            item.To?.some((to) => to.Address === email),
        )?.ID || "";
      return messageId;
    })
    .not.toBe("");
  const message = await (
    await request.get(`${mail}/api/v1/message/${messageId}`)
  ).json();
  const verification = new URL(message.Text.match(/https?:\/\/[^\s]+/)[0]);
  expect(verification.origin).toBe(baseURL);
  await page.goto(verification.href);
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Firmanızı oluşturun." }),
  ).toBeVisible();
  await page
    .getByLabel("Firma adı", { exact: true })
    .fill("Tarayıcı Kabul Firması");
  await page
    .getByRole("button", { name: "Çalışma alanını oluştur", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hesap güvenliği", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mevcut parola", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Doğrulamayı kur", exact: true })
    .click();
  await expect(page.locator(".portal-secret")).toHaveText(/^[A-Z2-7]+$/);
  const secret = (await page.locator(".portal-secret").innerText()).trim();
  await page.getByLabel("6 haneli kod", { exact: true }).fill(totp(secret));
  await page
    .getByRole("button", { name: "Kurulumu doğrula", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "İki aşamalı doğrulama etkin.",
  );

  await section(page, "Malzemeler");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Kod", { exact: true }).fill("MAT-BROWSER");
  await dialog.getByLabel("Ad", { exact: true }).fill("Kabul malzemesi");
  await dialog.getByLabel("Birim", { exact: true }).fill("adet");
  await dialog.getByLabel("Kritik seviye", { exact: true }).fill("2");
  await save(page);
  await expect(page.getByRole("table")).toContainText("MAT-BROWSER");
  await section(page, "Depolar ve sahiplik");
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  await dialog.getByLabel("Depo adı", { exact: true }).fill("Ana depo");
  await save(page);
  await section(page, "Stok hareketleri");
  await page
    .getByRole("button", { name: "Stok giriş / çıkış", exact: true })
    .click();
  await dialog
    .getByLabel("Malzeme", { exact: true })
    .selectOption({ label: "Kabul malzemesi · MAT-BROWSER" });
  await dialog
    .getByLabel("Depo", { exact: true })
    .selectOption({ label: "Ana depo" });
  await dialog.getByLabel("Yön", { exact: true }).selectOption("in");
  await dialog.getByLabel("Miktar", { exact: true }).fill("10.125");
  await save(page);
  await section(page, "Malzemeler");
  await expect(page.getByRole("table")).toContainText("10.125000");
  await page.screenshot({
    path: testInfo.outputPath("portal-inventory.png"),
    fullPage: true,
  });
  await testInfo.attach("Portal inventory", {
    path: testInfo.outputPath("portal-inventory.png"),
    contentType: "image/png",
  });

  await page
    .getByRole("button", { name: "Hesap güvenliği", exact: true })
    .click();
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByLabel("Doğrulama kodu", { exact: true }).fill(totp(secret));
  await page
    .getByRole("button", { name: "Yeniden doğrula", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("5 dakika");
  await section(page, "Roller ve izinler");
  await page.getByRole("button", { name: "Rol oluştur", exact: true }).click();
  await dialog
    .getByLabel("Rol adı", { exact: true })
    .fill("Katalog gözlemcisi");
  await dialog.getByLabel("Katalog: görüntüle", { exact: true }).check();
  await save(page);
  await expect(page.getByRole("table")).toContainText("Katalog gözlemcisi");
  await section(page, "Firma ayarları");
  await page
    .getByRole("button", { name: "Ayarları düzenle", exact: true })
    .click();
  await dialog
    .getByLabel("Saat dilimi", { exact: true })
    .fill("Europe/Istanbul");
  await dialog.getByLabel("Saklama süresi (gün)", { exact: true }).fill("400");
  await save(page);
  await expect(page.getByRole("table")).toContainText("400");
  await page.reload();
  await section(page, "Malzemeler");
  await expect(page.getByRole("table")).toContainText("10.125000");
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "İki aşamalı doğrulama", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Doğrulama kodu", { exact: true }).fill(totp(secret));
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await section(page, "Malzemeler");
  await expect(page.getByRole("table")).toContainText("MAT-BROWSER");
  expect(errors).toEqual([]);
});
