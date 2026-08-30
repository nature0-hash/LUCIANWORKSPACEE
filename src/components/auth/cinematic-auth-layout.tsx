"use client";

// LUCIAN Phase 16 — Cinematic auth layout (FINAL CORRECTED).
//
// FINAL CORRECTIONS:
//   - The auth card is opacity:0 + pointer-events:none until the
//     guardian's artifact-transformation phase completes. The reveal
//     is causally connected to the case → fragments → card sequence.
//   - Returning users (same browser session) get an abbreviated reveal:
//     no full entrance walk, just the case transform → auth card.
//     Detected via sessionStorage.
//   - A "Replay Scene" affordance in the corner lets the user replay
//     the full entrance if desired.
//   - prefers-reduced-motion: the auth card appears immediately, the
//     guardian renders as a static composition (already at the side).
//   - WebGL unavailable: a premium CSS-only fallback shows the same
//     composition. The form is fully functional in the fallback.
//   - Three.js resources are properly disposed on unmount.
//   - Switching auth states (signin/signup/forgot/reset) does NOT
//     replay the entrance — the guardian stays at the side.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LucianGuardian, type GuardianHandle } from "@/components/auth/lucian-guardian";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface AuthLayoutContextValue {
  onSuccess: () => void;
  onPasswordFocusChange: (focused: boolean) => void;
}

const AuthLayoutContext = createContext<AuthLayoutContextValue>({
  onSuccess: () => {},
  onPasswordFocusChange: () => {},
});

/** Hook used by auth pages to access the cinematic callbacks. */
export function useAuthLayout(): AuthLayoutContextValue {
  return useContext(AuthLayoutContext);
}

interface CinematicAuthLayoutProps {
  children: ReactNode;
}

const SESSION_KEY = "lucian-auth-seen";

export function CinematicAuthLayout({ children }: CinematicAuthLayoutProps) {
  const guardianHandleRef = useRef<GuardianHandle | null>(null);
  // Keep the server render and the browser's first render identical.
  // Browser-only capabilities are detected after hydration below.
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [successTriggered, setSuccessTriggered] = useState(false);
  // authCardVisible = false at start. Becomes true when the guardian's
  // transformation phase completes (onReveal). For reduced-motion OR
  // WebGL-unavailable cases, the capability effect reveals it immediately.
  const [authCardVisible, setAuthCardVisible] = useState(false);
  const [accentColor, setAccentColor] = useState("#d4a72c");
  const [canvasColor, setCanvasColor] = useState("#0e1013");
  const [surfaceColor, setSurfaceColor] = useState("#151a1e");
  const [forceFullReplay, setForceFullReplay] = useState(false);
  const hasSeenEntranceRef = useRef(false);

  // Detect browser-only capabilities after hydration. Computing these in
  // lazy state initializers made the server emit different markup from the
  // browser whenever WebGL or reduced-motion was available.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let supportsWebgl = false;
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
      supportsWebgl = !!gl;
    } catch {
      supportsWebgl = false;
    }

    // These updates intentionally synchronize client capabilities once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebglOk(supportsWebgl);
    setReducedMotion(mq.matches);
    if (mq.matches || !supportsWebgl) setAuthCardVisible(true);
  }, []);

  // Check sessionStorage to decide abbreviated vs full reveal.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      hasSeenEntranceRef.current = !!sessionStorage.getItem(SESSION_KEY);
    } catch { /* sessionStorage unavailable */ }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const acc = cs.getPropertyValue("--accent").trim() || "#d4a72c";
      const cnv = cs.getPropertyValue("--canvas").trim() || "#0e1013";
      const srf = cs.getPropertyValue("--surface").trim() || "#151a1e";
      if (acc) setAccentColor(acc);
      if (cnv) setCanvasColor(cnv);
      if (srf) setSurfaceColor(srf);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
    return () => obs.disconnect();
  }, []);

  // Mark that the user has seen the entrance so a return visit uses
  // the abbreviated reveal. The sessionStorage flag is per-tab.
  // (No setState-in-effect: the only mutation is a sessionStorage
  // write, which is a side effect, not a state update.)
  useEffect(() => {
    if (authCardVisible) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* non-fatal */ }
    }
  }, [authCardVisible]);

  const handleReveal = useCallback(() => {
    setAuthCardVisible(true);
  }, []);

  // If returning (abbreviated reveal), tell the guardian to skip the
  // entrance walk and jump straight to the transform phase. Only do
  // this once, after the guardian mounts.
  useEffect(() => {
    if (!forceFullReplay && hasSeenEntranceRef.current && webglOk === true && !reducedMotion) {
      // Small delay so the guardian's useEffect has run.
      const t = setTimeout(() => {
        guardianHandleRef.current?.skipEntrance();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [forceFullReplay, webglOk, reducedMotion]);

  const handleSuccess = useCallback(() => {
    setSuccessTriggered(true);
    guardianHandleRef.current?.triggerSuccess();
  }, []);

  const handlePasswordFocusChange = useCallback((focused: boolean) => {
    guardianHandleRef.current?.setLooksAway(focused);
  }, []);

  const handleReplay = useCallback(() => {
    setForceFullReplay(true);
    setAuthCardVisible(false);
    // Reload the page to restart the cinematic from scratch — simplest
    // way to fully reset the Three.js scene + phase state.
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* non-fatal */ }
      window.location.reload();
    }
  }, []);

  return (
    <AuthLayoutContext.Provider value={{ onSuccess: handleSuccess, onPasswordFocusChange: handlePasswordFocusChange }}>
      <div
        className="themed relative flex min-h-dvh w-full flex-col overflow-hidden bg-canvas text-fg"
        style={{
          background:
            "radial-gradient(ellipse at 25% 50%, rgba(0,0,0,0.2) 0%, var(--canvas) 60%)," +
            "radial-gradient(ellipse at 70% 30%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 50%)," +
            "var(--canvas)",
        }}
      >
        {/* 3D guardian scene — full background (auth card renders on top
            of the right half, so the guardian stays visible on the left
            half after the entrance). */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden lg:right-1/2"
          aria-hidden="true"
        >
          {webglOk === true && (
            <LucianGuardian
              accentColor={accentColor}
              canvasColor={canvasColor}
              surfaceColor={surfaceColor}
              reducedMotion={reducedMotion}
              handleRef={guardianHandleRef}
              onReveal={handleReveal}
            />
          )}
          {webglOk === false && (
            <StaticGuardianFallback accentColor={accentColor} />
          )}
        </div>

        {/* Auth card — right side on desktop, full-screen overlay on mobile.
            Initially opacity:0 + pointer-events:none. After the guardian's
            transformation phase completes (onReveal), it fades in + becomes
            interactive. */}
        <div
          className={cn(
            "relative z-10 flex min-h-dvh w-full items-center justify-center px-5 py-12 lg:w-1/2 lg:ml-auto",
            "transition-all duration-1000 ease-out",
            authCardVisible
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none translate-y-4",
          )}
        >
          <div className="w-full max-w-sm">
            {/* The animate-lucian-auth-card-in class plays a small
                transform animation when the card becomes visible —
                it visually ties the card's appearance to the
                guardian's artifact-transform energy burst. */}
            <div className={authCardVisible ? "animate-lucian-auth-card-in" : ""}>
              {children}
            </div>
          </div>
        </div>

        {/* Replay scene affordance — corner control */}
        {!reducedMotion && webglOk === true && (
          <button
            type="button"
            onClick={handleReplay}
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-md border border-line bg-surface/70 px-2 py-1.5 text-[10.5px] text-fg-muted backdrop-blur-sm hover:bg-hover hover:text-fg"
            title="Replay cinematic entrance"
          >
            <RotateCcw className="h-3 w-3" />
            Replay
          </button>
        )}

        {/* Loading hint while the entrance plays (only when the card
            is still hidden — never blocks interaction once it's visible). */}
        {!authCardVisible && !reducedMotion && webglOk === true && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10.5px] text-fg-faint/70 animate-pulse">
            Establishing secure session…
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-fg-faint/60">
          LUCIAN Workspace · Phase 16 Authentication
        </div>

        {/* Gateway success transition overlays */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-50 transition-opacity duration-1000 ease-out",
            successTriggered ? "opacity-100" : "opacity-0",
          )}
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent) 0%, var(--canvas) 70%)",
          }}
          aria-hidden="true"
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-50",
            successTriggered ? "animate-lucian-gateway" : "opacity-0",
          )}
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 0%, transparent 35%, color-mix(in srgb, var(--accent) 35%, transparent) 60%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      </div>
    </AuthLayoutContext.Provider>
  );
}

/** Premium static guardian silhouette drawn with pure CSS gradients.
 *  Used when WebGL is unavailable. The form remains fully functional. */
function StaticGuardianFallback({ accentColor }: { accentColor: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative h-[60vh] w-[40vh] max-h-[480px] max-w-[260px]">
        <div
          className="absolute -inset-10 rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 60%)` }}
        />
        <div
          className="absolute inset-0 rounded-t-[40%] rounded-b-[12%] opacity-95"
          style={{
            background:
              `linear-gradient(to bottom, ${accentColor}05 0%, var(--surface) 35%, var(--surface-2) 60%, var(--inset) 100%)`,
            border: "1px solid var(--line)",
            boxShadow: `0 20px 80px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.4)`,
          }}
        />
        <div
          className="absolute left-1/2 top-[35%] h-4 w-4 -translate-x-1/2 rounded-full"
          style={{
            background: accentColor,
            boxShadow: `0 0 24px ${accentColor}, 0 0 48px ${accentColor}80`,
          }}
        />
        <div
          className="absolute left-1/2 top-[50%] h-3 w-3 -translate-x-1/2 rounded-full"
          style={{
            background: accentColor,
            boxShadow: `0 0 16px ${accentColor}, 0 0 32px ${accentColor}80`,
          }}
        />
      </div>
    </div>
  );
}
