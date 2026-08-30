// LUCIAN Phase 16 — Delete account (Danger Zone).
//
// POST /api/auth/delete-account
//   { confirmEmail }
//
// Server flow:
//   1. Require authenticated session.
//   2. Require `confirmEmail` to match the user's email (typed safety
//      against accidental clicks).
//   3. In a single transaction: delete the User. Prisma CASCADE
//      deletes Account, Session, Profile, PasswordResetToken,
//      ChatConversation (+ChatMessage via CASCADE), AgentMemory,
//      UserNotification, SavedItem, UserDataMigration.
//   4. Vault records that have `ownerUserId = <userId>` are NOT
//      automatically cascade-deleted (they're separate tables with
//      nullable TEXT ownerUserId, not FK). We explicitly null their
//      ownerUserId so they become "unclaimed" again (they're manual
//      records — provider-backed records are still server-authoritative
//      and would be re-claimed if the same user re-creates the account).
//   5. Return success. The client signs out + redirects to /login.
//
// This is permanent + irreversible. There is NO undo.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/validation";
import { AuthError, badRequest, toAuthError } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

interface DeleteAccountBody {
  confirmEmail?: unknown;
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    return errorResponse(err as AuthError);
  }

  let body: DeleteAccountBody;
  try {
    body = await req.json() as DeleteAccountBody;
  } catch {
    return errorResponse(badRequest("Invalid request body."));
  }

  const confirmEmail = normalizeEmail(String(body.confirmEmail ?? ""));

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      return errorResponse({ code: "user_not_found", message: "Account not found.", statusCode: 404, name: "AuthError" } as AuthError);
    }
    if (confirmEmail !== user.email) {
      return errorResponse(badRequest("Email confirmation does not match your account email."));
    }

    // Transaction: delete the user (cascades to most data) + nullify
    // ownerUserId on Vault tables (they use nullable TEXT, not FK).
    await db.$transaction([
      db.user.delete({ where: { id: userId } }),
      // Nullify ownerUserId on the nullable-text Vault tables so the
      // records become "unclaimed" rather than dangling. This is
      // consistent with the existing Phase 16 ownership model.
      db.vaultAccount.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.ledgerEntry.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.vaultTransaction.updateMany({ where: { userId }, data: { userId: null } }),
      db.paymentMethod.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.bankAccount.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.cryptoWallet.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.withdrawalDestination.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.providerConnection.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.processedProviderEvent.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.idempotencyRecord.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.autoFundConfig.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      db.vaultSecuritySettings.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
    ]);

    return NextResponse.json({ ok: true, message: "Account deleted. Redirecting to sign in…" });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

function errorResponse(err: AuthError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.message, code: err.code },
    { status: err.statusCode },
  );
}
