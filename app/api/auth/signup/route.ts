// LUCIAN Phase 16 — Real signup endpoint (FINAL CORRECTED).
//
// POST /api/auth/signup
//   { email, username, password, confirmPassword, displayName }
//
// Server flow:
//   1. Validate input (email format, username format, password strength, name length).
//   2. Normalize email + username to lowercase.
//   3. Check database availability (503 + database_unavailable if down).
//   4. Check email + username uniqueness (409 + email_taken/username_taken if exists).
//   5. Hash password with bcryptjs (cost 12).
//   6. Create User + Profile in a single Prisma transaction.
//   7. Return the safe user object (no passwordHash).
//
// Auth.js then signs the user in via the credentials provider (the
// client calls signIn("credentials", { username, password }, ...) after a
// 200 response — the username field accepts either an email or a username).
//
// No fake success. No hardcoded demo user. Errors map to typed codes
// the UI renders inline (no browser alert()).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidDisplayName,
  normalizeEmail,
  normalizeUsername,
  validatePasswordDetailed,
} from "@/lib/auth/validation";
import {
  AuthError,
  emailTaken,
  usernameTaken,
  invalidEmail,
  invalidUsername,
  weakPassword,
  passwordMismatch,
  badRequest,
  databaseUnavailable,
  toAuthError,
} from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

interface SignupBody {
  email?: unknown;
  username?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  displayName?: unknown;
}

export async function POST(req: Request) {
  let body: SignupBody;
  try {
    body = await req.json() as SignupBody;
  } catch {
    return errorResponse(badRequest("Invalid request body."));
  }

  const email = normalizeEmail(String(body.email ?? ""));
  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");
  const displayName = String(body.displayName ?? "").trim();

  // Validate input — return early with typed errors.
  if (!isValidEmail(email)) return errorResponse(invalidEmail());
  if (!isValidUsername(username)) return errorResponse(invalidUsername());
  if (!isValidDisplayName(displayName)) {
    return errorResponse(badRequest("Please enter a display name (1–64 characters)."));
  }
  const pwErr = validatePasswordDetailed(password);
  if (pwErr) return errorResponse(weakPassword(pwErr.message));
  if (password !== confirmPassword) return errorResponse(passwordMismatch());

  // Database availability — refuse before touching the DB.
  if (!process.env.DATABASE_URL) {
    return errorResponse(databaseUnavailable());
  }

  try {
    // Uniqueness check — race-free because both columns are unique;
    // a concurrent signup that wins the race will trigger the unique
    // constraint violation we catch below.
    const [existingEmail, existingUsername] = await Promise.all([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      db.user.findUnique({ where: { username }, select: { id: true } }),
    ]);
    if (existingEmail) return errorResponse(emailTaken());
    if (existingUsername) return errorResponse(usernameTaken());

    // Create user + profile atomically.
    const user = await db.user.create({
      data: {
        email,
        username,
        name: displayName,
        passwordHash: await hashPassword(password),
        emailVerified: null, // email verification not yet implemented
        status: "active",
        profile: {
          create: {
            displayName,
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        image: true,
        emailVerified: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    const authErr = toAuthError(err);
    // Prisma unique-constraint violation on email or username → friendly message.
    const msg = String((err as Error)?.message ?? "");
    if (authErr.code === "internal_error" && /unique/i.test(msg)) {
      if (/username/i.test(msg)) return errorResponse(usernameTaken());
      if (/email/i.test(msg)) return errorResponse(emailTaken());
      return errorResponse(emailTaken());
    }
    return errorResponse(authErr);
  }
}

function errorResponse(err: AuthError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.message, code: err.code },
    { status: err.statusCode },
  );
}
