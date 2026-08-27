// LUCIAN Phase 16 — Owner account bootstrap.
//
// Usage:
//   LUCIAN_OWNER_USERNAME=LUCIAN1975 \
//   LUCIAN_OWNER_PASSWORD=<your secret> \
//   LUCIAN_OWNER_EMAIL=owner@example.com \
//   npm run bootstrap:owner
//
// This script is SAFE to run multiple times:
//   - If the owner account already exists (by username or email), it
//     leaves the existing password alone. We NEVER overwrite the owner's
//     password automatically — that would be a security risk.
//   - If the owner account does not exist, it creates it with a hashed
//     password + Profile row.
//
// The owner password is NEVER:
//   - logged to stdout/stderr
//   - written to a file
//   - included in API responses / error messages
//   - exposed to the client bundle
//
// The owner becomes a normal LUCIAN user in Neon — there is no
// "superuser" flag. The owner can do everything any authenticated user
// can do (the owner has no special elevated powers, just a known
// username + the password the operator set).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const OWNER_USERNAME = process.env.LUCIAN_OWNER_USERNAME;
const OWNER_PASSWORD = process.env.LUCIAN_OWNER_PASSWORD;
const OWNER_EMAIL =
  process.env.LUCIAN_OWNER_EMAIL ?? "owner@lucian.local";

async function main() {
  if (!OWNER_USERNAME) {
    console.error(
      "[bootstrap:owner] LUCIAN_OWNER_USERNAME is required. Example:\n" +
        "  LUCIAN_OWNER_USERNAME=LUCIAN1975 \\\n" +
        "  LUCIAN_OWNER_PASSWORD=<secret> \\\n" +
        "  npm run bootstrap:owner",
    );
    process.exit(1);
  }
  if (!OWNER_PASSWORD) {
    console.error(
      "[bootstrap:owner] LUCIAN_OWNER_PASSWORD is required. Set it in your environment (do NOT put it in source or .env files committed to Git).",
    );
    process.exit(1);
  }

  // Username must match the schema's username validator (lowercase letters,
  // digits, underscore, hyphen). The owner username "LUCIAN1975" is
  // normalized to lowercase "lucian1975" before storing — both forms
  // work for login (the credentials provider normalizes input too).
  const normalizedUsername = OWNER_USERNAME.trim().toLowerCase();
  const normalizedEmail = OWNER_EMAIL.trim().toLowerCase();

  // Already exists?
  const existing = await db.user.findFirst({
    where: {
      OR: [{ username: normalizedUsername }, { email: normalizedEmail }],
    },
    select: { id: true, username: true, email: true },
  });
  if (existing) {
    console.log(
      `[bootstrap:owner] Owner account already exists (username=${existing.username}, email=${existing.email}). ` +
        `Leaving password unchanged. To reset the owner password, use the normal password-reset flow.`,
    );
    return;
  }

  // Hash password with bcryptjs (cost 12, same as the rest of Phase 16).
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);

  // Create user + profile atomically. sessionVersion defaults to 0 in
  // the schema; we set it explicitly here so the very first JWT issued
  // for the owner matches the DB row (no stale-version edge case on
  // bootstrap → immediate login).
  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      name: "LUCIAN Owner",
      passwordHash,
      status: "active",
      sessionVersion: 0,
      profile: {
        create: {
          displayName: "LUCIAN Owner",
        },
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
      status: true,
      createdAt: true,
    },
  });

  console.log(
    `[bootstrap:owner] OK — owner account created.\n` +
      `  id:        ${user.id}\n` +
      `  username:  ${user.username}\n` +
      `  email:     ${user.email}\n` +
      `  status:    ${user.status}\n` +
      `  createdAt: ${user.createdAt.toISOString()}`,
  );
  // Note: the password is intentionally NOT echoed back.
}

main()
  .catch((err) => {
    console.error("[bootstrap:owner] FAILED:", err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
