import { getPayload } from "payload";
import config from "../payload.config.js";
const { CMS_ADMIN_EMAIL: email, CMS_ADMIN_PASSWORD: password } = process.env;
if (!email || !password || password.length < 16)
  throw Error(
    "Set CMS_ADMIN_EMAIL and a CMS_ADMIN_PASSWORD of at least 16 characters in the secret store.",
  );
const payload = await getPayload({ config });
try {
  const existing = await payload.count({
    collection: "staff",
    overrideAccess: true,
  });
  if (existing.totalDocs)
    throw Error("CMS already has staff; initial bootstrap is closed.");
  await payload.create({
    collection: "staff",
    overrideAccess: true,
    context: { bootstrap: true },
    data: { name: "OLAPH administrator", email, password, role: "admin" },
  });
  console.log(
    "Initial CMS administrator created. Credentials were not printed.",
  );
} finally {
  await payload.destroy();
}
