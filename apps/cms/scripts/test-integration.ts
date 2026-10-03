import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import config from "../payload.config.js";
if (
  process.env.NODE_ENV !== "test" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.CMS_DATABASE_URL || "").hostname,
  )
)
  throw Error("CMS test requires a disposable local test database.");
const payload = await getPayload({ config });
try {
  const suffix = randomUUID();
  const makeUser = async (role: string) => ({
    ...(await payload.create({
      collection: "staff",
      context: { bootstrap: true },
      overrideAccess: true,
      data: {
        name: role,
        role,
        email: `${role}-${suffix}@example.test`,
        password: `Test-only-${suffix}`,
      },
    })),
    collection: "staff" as const,
  });
  const editor = await makeUser("editor"),
    publisher = await makeUser("publisher");
  const draft = await payload.create({
    collection: "posts",
    locale: "tr",
    user: editor,
    overrideAccess: false,
    draft: true,
    data: { title: "Taslak yazı", slug: suffix, _status: "draft" },
  });
  assert.equal(
    (
      await payload.find({
        collection: "posts",
        overrideAccess: false,
        where: { id: { equals: draft.id } },
      })
    ).totalDocs,
    0,
  );
  await payload
    .update({
      collection: "posts",
      id: draft.id,
      user: editor,
      overrideAccess: false,
      data: { _status: "published" },
    })
    .catch(() => undefined);
  assert.equal(
    (
      await payload.find({
        collection: "posts",
        overrideAccess: false,
        where: { id: { equals: draft.id } },
      })
    ).totalDocs,
    0,
    "Editor must not publish",
  );
  await payload.update({
    collection: "posts",
    id: draft.id,
    locale: "tr",
    user: publisher,
    overrideAccess: false,
    data: { _status: "published" },
  });
  assert.equal(
    (
      await payload.find({
        collection: "posts",
        locale: "tr",
        overrideAccess: false,
        where: { id: { equals: draft.id } },
      })
    ).totalDocs,
    1,
  );
  await assert.rejects(
    payload.update({
      collection: "posts",
      id: draft.id,
      user: editor,
      overrideAccess: false,
      data: { title: "Unapproved change" },
    }),
  );
  await assert.rejects(
    payload.create({
      collection: "legal",
      user: publisher,
      overrideAccess: false,
      data: { title: "Unreviewed legal", slug: suffix, _status: "published" },
    }),
  );
  await assert.rejects(
    payload.find({ collection: "staff", overrideAccess: false, user: editor }),
  );
  console.log(
    "PASS: CMS schema, private drafts, publisher approval, protection of published content, legal review requirement and staff access.",
  );
} finally {
  await payload.destroy();
}
