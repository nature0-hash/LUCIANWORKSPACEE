// LUCIAN Phase 16 — Sign Up page.

import { AuthCard } from "@/components/auth/auth-card";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthCard initialState="signup" />
    </Suspense>
  );
}
