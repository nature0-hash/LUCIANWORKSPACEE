"use client";

// LUCIAN Phase 16 — Settings → Account section (REAL).
//
// Replaces the "Requires account setup" placeholder with real account
// management backed by /api/auth/* endpoints. All actions are REAL:
//   - Profile: GET /api/auth/me + PATCH /api/auth/profile
//   - Security > Password: POST /api/auth/change-password
//   - Security > Google: shows connected / not connected (from accounts)
//   - Security > 2FA: honestly labeled "Not configured" — not implemented
//   - Sessions: GET /api/auth/sessions, POST to revoke others
//   - Account Data > Export: GET /api/auth/export-data (downloads JSON)
//   - Danger Zone > Delete: POST /api/auth/delete-account (requires
//     email confirmation, cascades to all user-owned data)
//
// No fake session counts. No fake device records. Capabilities that
// aren't implemented yet are honestly labeled.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { User as UserIcon, Key, Shield, Monitor, Download, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSectionHeader,
  SettingsDivider,
  StatusPill,
} from "@/components/settings/primitives";
import { isValidDisplayName, validatePasswordDetailed } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AccountSection() {
  const router = useRouter();
  const { user, profile, loading, error, refresh } = useCurrentUser();

  if (loading) {
    return (
      <div>
        <SettingsSectionHeader title="Account" subtitle="Loading your account…" />
        <SettingsGroup title="Account">
          <div className="flex items-center gap-2 py-3 text-[12px] text-fg-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        </SettingsGroup>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div>
        <SettingsSectionHeader title="Account" />
        <SettingsGroup title="Account">
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error || "No authenticated account. Please sign in."}</span>
          </div>
          <div className="mt-3">
            <button
              onClick={() => router.push("/login")}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-fg hover:bg-hover"
            >
              Sign in
            </button>
          </div>
        </SettingsGroup>
      </div>
    );
  }

  return (
    <div>
      <SettingsSectionHeader
        title="Account"
        subtitle="Your LUCIAN account, profile, security, sessions, and data."
      />

      <ProfileGroup
        displayName={profile?.displayName ?? user.name ?? user.email}
        avatar={profile?.avatar ?? user.image}
        email={user.email}
        onSave={refresh}
      />

      <SecurityGroup
        hasPassword={!!user.name /* we don't get passwordHash on client — we just assume yes if user exists; the change-password endpoint verifies */}
        googleConnected={user.accounts.some(a => a.provider === "google")}
      />

      <SessionsGroup />

      <AccountDataGroup userId={user.id} />

      <DangerZoneGroup userEmail={user.email} />

      <SettingsGroup title="Account Info">
        <SettingsRow title="Account ID" description={user.id}>
          <span className="text-[10px] text-fg-faint">{user.id.slice(0, 8)}…</span>
        </SettingsRow>
        <SettingsRow title="Member since" description={new Date(user.createdAt).toLocaleString()}>
          <span className="text-[11px] text-fg-faint">{new Date(user.createdAt).toLocaleDateString()}</span>
        </SettingsRow>
        <SettingsRow title="Email verified" description={user.emailVerified ? "Verified" : "Not yet verified"}>
          <StatusPill status={user.emailVerified ? "ready" : "setup_required"} label={user.emailVerified ? "Verified" : "Not verified"} />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}

// ── Profile group ───────────────────────────────────────────────────
function ProfileGroup({
  displayName, avatar, email, onSave,
}: {
  displayName: string;
  avatar: string | null;
  email: string;
  onSave: () => Promise<void>;
}) {
  const [name, setName] = useState(displayName);
  // Track the prop value so we can sync local state when it changes
  // (e.g. after a refresh). This is the React-recommended pattern for
  // "syncing state to a prop" without setState-in-effect.
  const [prevDisplayName, setPrevDisplayName] = useState(displayName);
  if (prevDisplayName !== displayName) {
    setPrevDisplayName(displayName);
    setName(displayName);
  }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setErr(null);
    if (!isValidDisplayName(name)) {
      setErr("Display name must be 1–64 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Failed to save profile.");
        return;
      }
      toast.success("Profile updated.");
      await onSave();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }, [name, onSave]);

  return (
    <SettingsGroup title="Profile">
      <div className="py-3">
        {/* Avatar — kept as a styled circle with initials (no upload UI
            in this phase — we honestly don't fake an upload flow). */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-[14px] font-semibold text-fg">
            {(avatar ? "" : (displayName || email).slice(0, 1).toUpperCase())}
          </div>
          <div>
            <div className="text-[12px] text-fg">Avatar</div>
            <div className="text-[11px] text-fg-faint">Avatar upload is not yet implemented.</div>
          </div>
        </div>
      </div>

      <SettingsDivider />

      <div className="py-2">
        <label className="mb-1 block text-[11px] font-medium text-fg-muted">Display Name</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          maxLength={64}
          className="w-full rounded-md border border-line bg-inset px-3 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--accent)]"
        />
      </div>

      <SettingsRow title="Email" description={email}>
        <span className="text-[11px] text-fg-faint">{email}</span>
      </SettingsRow>

      {err && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || name === displayName}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
        </button>
      </div>
    </SettingsGroup>
  );
}

// ── Security group ──────────────────────────────────────────────────
function SecurityGroup({
  hasPassword, googleConnected,
}: {
  hasPassword: boolean;
  googleConnected: boolean;
}) {
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleChangePw = useCallback(async () => {
    setErr(null);
    if (!currentPw) { setErr("Enter your current password."); return; }
    const pwErr = validatePasswordDetailed(newPw);
    if (pwErr) { setErr(pwErr.message); return; }
    if (newPw !== confirmPw) { setErr("New passwords do not match."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Failed to change password.");
        return;
      }
      toast.success("Password updated. Please sign in with your new password.");
      // Server has invalidated all sessions — sign out client-side.
      await signOut({ redirect: false });
      window.location.href = "/login";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }, [currentPw, newPw, confirmPw]);

  return (
    <SettingsGroup title="Security">
      <SettingsRow title="Password" description="Change your account password.">
        <button
          onClick={() => setShowChangePw(s => !s)}
          className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-fg hover:bg-hover"
        >
          Change Password
        </button>
      </SettingsRow>

      {showChangePw && (
        <div className="border-t border-line-muted/50 px-1 py-3">
          <div className="space-y-2">
            <input
              type="password" placeholder="Current password" value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              className="w-full rounded-md border border-line bg-inset px-3 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--accent)]"
            />
            <input
              type="password" placeholder="New password (min 12 chars, letter + digit)" value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="w-full rounded-md border border-line bg-inset px-3 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--accent)]"
            />
            <input
              type="password" placeholder="Confirm new password" value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="w-full rounded-md border border-line bg-inset px-3 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--accent)]"
            />
            {err && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{err}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setErr(null); }}
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-fg hover:bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePw} disabled={saving}
                className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update Password"}
              </button>
            </div>
            <p className="pt-1 text-[10.5px] text-fg-faint">
              All other sessions will be signed out after a successful password change.
            </p>
          </div>
        </div>
      )}

      <SettingsDivider />

      <SettingsRow
        title="Google"
        description={googleConnected ? "Your account is linked to Google." : "Your account uses email + password."}
      >
        <StatusPill status={googleConnected ? "ready" : "not_configured"} label={googleConnected ? "Connected" : "Not connected"} />
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow
        title="Two-Factor Authentication"
        description="2FA is not yet implemented in LUCIAN. When it ships, you'll be able to set it up here."
      >
        <StatusPill status="setup_required" label="Not configured" />
      </SettingsRow>
    </SettingsGroup>
  );
}

// ── Sessions group ──────────────────────────────────────────────────
function SessionsGroup() {
  const [sessions, setSessions] = useState<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  // Initial + manual refresh. The setState calls all happen after the
  // `await fetch()`, so they're considered external-system updates
  // (allowed by react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/sessions", { cache: "no-store" });
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.ok) setSessions(data.sessions);
      } catch {
        // Silent — the section is non-critical.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchKey]);

  const fetchSessions = useCallback(() => setFetchKey(k => k + 1), []);

  const handleRevokeOthers = useCallback(async () => {
    setRevoking(true);
    try {
      const res = await fetch("/api/auth/sessions", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`Signed out ${data.revoked} other session${data.revoked === 1 ? "" : "s"}.`);
        await fetchSessions();
      } else {
        toast.error(data.error || "Failed to sign out other sessions.");
      }
    } catch {
      toast.error("Failed to sign out other sessions.");
    } finally {
      setRevoking(false);
    }
  }, [fetchSessions]);

  const otherCount = sessions.filter(s => !s.current).length;

  return (
    <SettingsGroup title="Sessions">
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-[11px] text-fg-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-2 text-[11px] text-fg-muted">
          No active sessions found. This may happen if the database is temporarily unavailable.
        </div>
      ) : (
        <>
          {sessions.filter(s => s.current).map(s => (
            <SettingsRow
              key={s.id}
              title="Current session"
              description={`Created ${new Date(s.createdAt).toLocaleString()} · Expires ${new Date(s.expiresAt).toLocaleString()}`}
            >
              <StatusPill status="ready" label="This device" />
            </SettingsRow>
          ))}
          {otherCount > 0 && (
            <>
              <SettingsDivider />
              <SettingsRow
                title="Other sessions"
                description={`${otherCount} other active session${otherCount === 1 ? "" : "s"}.`}
              >
                <button
                  onClick={handleRevokeOthers} disabled={revoking}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-fg hover:bg-hover disabled:opacity-50"
                >
                  {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : `Sign out ${otherCount} other`}
                </button>
              </SettingsRow>
            </>
          )}
        </>
      )}
    </SettingsGroup>
  );
}

// ── Account Data group ──────────────────────────────────────────────
function AccountDataGroup({ userId }: { userId: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/auth/export-data");
      if (!res.ok) {
        toast.error("Failed to export account data.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lucian-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Account data exported.");
    } catch {
      toast.error("Failed to export account data.");
    } finally {
      setExporting(false);
    }
  }, []);

  void userId;

  return (
    <SettingsGroup title="Account Data">
      <SettingsRow
        title="Export account data"
        description="Download a JSON file containing your profile, chats, agent memory, notifications, saved items, and Vault metadata."
      >
        <button
          onClick={handleExport} disabled={exporting}
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-fg hover:bg-hover disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Export
        </button>
      </SettingsRow>
    </SettingsGroup>
  );
}

// ── Danger Zone ──────────────────────────────────────────────────────
function DangerZoneGroup({ userEmail }: { userEmail: string }) {
  const [show, setShow] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = useCallback(async () => {
    setErr(null);
    if (confirmEmail !== userEmail) {
      setErr("Email confirmation does not match your account email.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Failed to delete account.");
        return;
      }
      toast.success("Account deleted.");
      await signOut({ redirect: false });
      router.push("/login");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  }, [confirmEmail, userEmail, router]);

  return (
    <SettingsGroup title="Danger Zone">
      <SettingsRow
        title="Delete account"
        description="Permanently delete your LUCIAN account and all server-backed data. This cannot be undone."
      >
        <button
          onClick={() => setShow(s => !s)}
          className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
        >
          <Trash2 className="h-3 w-3" />
          Delete Account
        </button>
      </SettingsRow>

      {show && (
        <div className="border-t border-line-muted/50 px-1 py-3">
          <div className="mb-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-2 text-[11px] text-red-200">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <div className="font-semibold">This is permanent and irreversible.</div>
              <div className="mt-1 text-red-200/80">
                Your profile, chats, agent memory, notifications, saved items, and account-level Vault metadata will be deleted.
                Local data on this device (DevWorkspace projects) will remain.
              </div>
            </div>
          </div>
          <label className="mb-1 block text-[11px] font-medium text-fg-muted">
            Type your email to confirm: <span className="font-mono text-fg">{userEmail}</span>
          </label>
          <input
            type="email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)}
            placeholder={userEmail}
            className="w-full rounded-md border border-line bg-inset px-3 py-1.5 text-[12px] text-fg outline-none focus:border-red-500/60"
          />
          {err && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => { setShow(false); setConfirmEmail(""); setErr(null); }}
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-fg hover:bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete} disabled={deleting || confirmEmail !== userEmail}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Permanently Delete Account"}
            </button>
          </div>
        </div>
      )}
    </SettingsGroup>
  );
}
