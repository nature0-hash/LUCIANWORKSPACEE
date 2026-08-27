"use client";

// LUCIAN Phase 16 — Cinematic LUCIAN Guardian (FINAL CORRECTED).
//
// FINAL CORRECTIONS:
//   - The guardian ENTERS rather than already being present. The scene
//     starts with a closed luminous doorway in the background. The
//     doorway opens, the guardian steps through, walks toward the
//     foreground carrying an artifact (case), stops, then presents the
//     case which transforms into the auth card.
//   - The auth card itself is opacity:0 + pointer-events:none until
//     the transformation phase completes. The reveal is causally
//     connected to the case's energy-burst animation.
//   - After reveal, the guardian moves to the side (right edge of the
//     canvas on desktop) and remains reactive: subtle pointer-tracking
//     head/look motion, looks away when the password field is focused.
//   - Switching auth states (signin ↔ signup ↔ forgot ↔ reset) does
//     NOT replay the entrance — the guardian stays at the side.
//   - Returning to the login page during the same browser session uses
//     an abbreviated reveal (no full entrance, just the case transform).
//     A "Replay Scene" affordance is provided in the corner for users
//     who want the full sequence again.
//   - prefers-reduced-motion: the scene renders as a static composition
//     with the guardian already beside the form. No doorway animation,
//     no walk cycle. The auth card appears immediately. Reduced-motion
//     users can authenticate instantly.
//   - WebGL unavailable: a premium CSS/2D fallback shows the same
//     composition with CSS transitions instead of Three.js animations.
//     The form is fully functional in the fallback.
//
// The scene uses Three.js (single mesh + a couple of lights). No
// textures, no shadows, no env map. ~60fps on a mid-range laptop.
// Three.js resources are properly disposed on unmount to prevent
// memory leaks across auth-state transitions.

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface GuardianHandle {
  /** Set the "looks away" state — guardian rotates away when true. */
  setLooksAway: (v: boolean) => void;
  /** Trigger the success animation — guardian raises the orb + the
   *  scene begins the gateway transition. */
  triggerSuccess: () => void;
  /** Force the abbreviated reveal (skip the entrance walk). Used when
   *  the user returns to the login page during the same session. */
  skipEntrance: () => void;
  /** Trigger the artifact → auth card transformation phase. The
   *  CinematicAuthLayout calls this when the entrance is done so the
   *  auth card can fade in. After this, the guardian moves to the
   *  side and becomes reactive. */
  triggerTransform: () => void;
}

interface GuardianSceneProps {
  /** Accent color (from CSS variable) for the inner glow. */
  accentColor: string;
  /** Background color (from CSS variable). */
  canvasColor: string;
  /** Surface color (from CSS variable) for the figure material. */
  surfaceColor: string;
  /** Whether reduced motion is preferred. */
  reducedMotion: boolean;
  /** Ref to expose the imperative handle. */
  handleRef: React.MutableRefObject<GuardianHandle | null>;
  /** Callback fired when the transformation phase completes — the
   *  parent uses this to reveal the auth card. */
  onReveal: () => void;
}

/** Phase timings (seconds). Used to coordinate animations + the
 *  onReveal callback. */
const PHASE = {
  doorway: 1.0,        // door opens
  enter: 1.5,          // guardian steps through + walks forward
  settle: 0.6,         // stops walking, presents case
  transform: 1.2,      // case transforms into energy + auth card appears
  total: 4.3,          // total entrance time before onReveal
};

export function LucianGuardian({
  accentColor,
  canvasColor,
  surfaceColor,
  reducedMotion,
  handleRef,
  onReveal,
}: GuardianSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene setup ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      35,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.5, 7);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ── Doorway (a luminous portal frame) ────────────────────────
    // Built from 4 thin boxes arranged as a vertical rectangle frame.
    // The frame's inner glow brightens during the "doorway" phase.
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0.4, -2.5);
    scene.add(doorGroup);
    const doorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.7,
    });
    const doorH = 2.0, doorW = 1.2, doorT = 0.08;
    const top = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.2, doorT, doorT), doorMat);
    top.position.y = doorH / 2;
    doorGroup.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.2, doorT, doorT), doorMat);
    bot.position.y = -doorH / 2;
    doorGroup.add(bot);
    const left = new THREE.Mesh(new THREE.BoxGeometry(doorT, doorH, doorT), doorMat);
    left.position.x = -doorW / 2;
    doorGroup.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(doorT, doorH, doorT), doorMat);
    right.position.x = doorW / 2;
    doorGroup.add(right);

    // The "light" inside the doorway — a flat plane that brightens
    // when the door opens.
    const doorLightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accentColor),
      transparent: true,
      opacity: 0.0,
    });
    const doorLight = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), doorLightMat);
    doorLight.position.z = -0.02;
    doorGroup.add(doorLight);

    // ── Guardian figure (starts hidden behind the doorway) ───────
    const silhouette = buildGuardianSilhouette();
    const guardianMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(surfaceColor),
      roughness: 0.45,
      metalness: 0.35,
      transparent: true,
      opacity: 0.0, // hidden at start
    });
    const guardian = new THREE.Mesh(silhouette, guardianMat);
    guardian.position.set(0, -0.6, -2.0); // behind the doorway initially
    scene.add(guardian);

    // ── Inner energy core (inside the guardian's chest) ─────────
    const coreGeo = new THREE.IcosahedronGeometry(0.18, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.0,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.1, 0.55);
    guardian.add(core);

    // ── Artifact / case the guardian carries ────────────────────
    // A small box held in front of the guardian at chest height. On
    // success, it scales up + glows brighter (this is the thing that
    // "transforms into the auth card" cinematically — the auth card
    // itself is rendered separately in front of the canvas).
    const caseGeo = new THREE.BoxGeometry(0.3, 0.2, 0.2);
    const caseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.0,
    });
    const artifact = new THREE.Mesh(caseGeo, caseMat);
    artifact.position.set(0, 0.15, 0.9);
    guardian.add(artifact);

    // ── Energy fragments (spawned during the transform phase) ───
    // A pool of small emissive shards that fly outward from the case
    // then converge toward the auth-card position (right side of the
    // screen on desktop).
    const fragments: THREE.Mesh[] = [];
    const fragmentGeo = new THREE.TetrahedronGeometry(0.06, 0);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(accentColor),
        emissive: new THREE.Color(accentColor),
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.0,
      });
      const frag = new THREE.Mesh(fragmentGeo, m);
      frag.visible = false;
      scene.add(frag);
      fragments.push(frag);
    }

    // ── Lighting ─────────────────────────────────────────────────
    const keyLight = new THREE.DirectionalLight(new THREE.Color(accentColor).multiplyScalar(0.6), 1.0);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);
    const ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(ambient);

    // ── Floor reflection plane (subtle) ────────────────────────
    const floorGeo = new THREE.CircleGeometry(3, 64);
    const floorMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(canvasColor),
      transparent: true,
      opacity: 0.4,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.3;
    scene.add(floor);

    // ── Animation state ──────────────────────────────────────────
    type Phase = "idle" | "doorway" | "enter" | "settle" | "transform" | "revealed" | "success";
    let phase: Phase = reducedMotion ? "revealed" : "idle";
    let phaseT = 0;
    let looksAway = false;
    let successT = 0;
    let pointerX = 0;
    let pointerY = 0;
    let breathPhase = 0;
    let rafId = 0;
    let mounted = true;
    let onRevealFired = false;

    handleRef.current = {
      setLooksAway: (v: boolean) => { looksAway = v; },
      triggerSuccess: () => {
        if (phase !== "revealed") return; // only after reveal
        phase = "success";
        successT = 0;
      },
      skipEntrance: () => {
        // For returning users — jump directly to the transform phase.
        if (phase === "idle" || phase === "doorway" || phase === "enter" || phase === "settle") {
          phase = "transform";
          phaseT = 0;
          // Snap the guardian into its "presenting the case" pose.
          guardianMat.opacity = 0.96;
          coreMat.opacity = 0.85;
          caseMat.opacity = 0.95;
          guardian.position.set(0, -0.6, 0);
        }
      },
      triggerTransform: () => {
        if (phase === "settle") {
          phase = "transform";
          phaseT = 0;
        }
      },
    };

    function onPointerMove(e: PointerEvent) {
      if (reducedMotion) return;
      const rect = mount?.getBoundingClientRect();
      if (!rect) return;
      pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }
    window.addEventListener("pointermove", onPointerMove);

    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    function fireReveal() {
      if (onRevealFired) return;
      onRevealFired = true;
      onReveal();
    }

    function tick() {
      if (!mounted) return;
      rafId = requestAnimationFrame(tick);
      const dt = 0.016;
      phaseT += dt;

      // Phase progression (only when not in reduced-motion — RM starts
      // in "revealed" phase so the form is instantly usable).
      if (phase === "idle" && phaseT >= 0.3) {
        phase = "doorway";
        phaseT = 0;
      } else if (phase === "doorway" && phaseT >= PHASE.doorway) {
        phase = "enter";
        phaseT = 0;
      } else if (phase === "enter" && phaseT >= PHASE.enter) {
        phase = "settle";
        phaseT = 0;
      } else if (phase === "settle" && phaseT >= PHASE.settle) {
        phase = "transform";
        phaseT = 0;
      } else if (phase === "transform" && phaseT >= PHASE.transform) {
        phase = "revealed";
        phaseT = 0;
        fireReveal();
      }

      // Phase-driven animations
      if (phase === "doorway") {
        const s = Math.min(phaseT / PHASE.doorway, 1.0);
        const ease = 1 - Math.pow(1 - s, 3);
        doorLightMat.opacity = ease * 0.6;
        doorMat.emissiveIntensity = 0.4 + ease * 0.8;
      } else if (phase === "enter") {
        const s = Math.min(phaseT / PHASE.enter, 1.0);
        const ease = 1 - Math.pow(1 - s, 3);
        // Guardian walks from z=-2.0 to z=0 (foreground)
        guardian.position.z = -2.0 + ease * 2.0;
        guardianMat.opacity = ease * 0.96;
        coreMat.opacity = ease * 0.85;
        // Walking bob
        guardian.position.y = -0.6 + Math.sin(phaseT * 6) * 0.06 * (1 - ease);
        // Door light dims as guardian steps through
        doorLightMat.opacity = 0.6 * (1 - ease);
      } else if (phase === "settle") {
        const s = Math.min(phaseT / PHASE.settle, 1.0);
        const ease = 1 - Math.pow(1 - s, 3);
        // Guardian stops, raises the case slightly to "present" it
        artifact.position.y = 0.15 + ease * 0.2;
        artifact.position.z = 0.9 + ease * 0.15;
        caseMat.opacity = ease * 0.95;
        caseMat.emissiveIntensity = 0.7 + ease * 0.5;
      } else if (phase === "transform") {
        const s = Math.min(phaseT / PHASE.transform, 1.0);
        const ease = 1 - Math.pow(1 - s, 3);
        // Case scales up + brightens, then fragments outward
        artifact.scale.setScalar(1 + ease * 2.0);
        caseMat.emissiveIntensity = 1.2 + ease * 2.0;
        // Spawn fragments at s=0.3, converge them toward the auth-card
        // position (right side of the screen) by s=0.9
        if (s > 0.3 && s < 0.95) {
          const fragT = (s - 0.3) / 0.65;
          fragments.forEach((frag, i) => {
            frag.visible = true;
            const angle = (i / fragments.length) * Math.PI * 2;
            const radius = 0.4 + fragT * 1.5;
            // Start near the case, end at the auth-card position (right side)
            const startX = 0;
            const startY = 0.3;
            const startZ = 0.9;
            const endX = 2.5;
            const endY = 0.0;
            const endZ = 1.0;
            const t = Math.min(fragT * 1.2, 1);
            const easeT = 1 - Math.pow(1 - t, 2);
            frag.position.x = startX + (endX - startX) * easeT + Math.cos(angle) * radius * (1 - easeT) * 0.5;
            frag.position.y = startY + (endY - startY) * easeT + Math.sin(angle) * radius * (1 - easeT) * 0.5;
            frag.position.z = startZ + (endZ - startZ) * easeT;
            (frag.material as THREE.MeshStandardMaterial).opacity = (1 - easeT) * 0.9;
            frag.scale.setScalar(1 + easeT * 0.5);
          });
        } else if (s >= 0.95) {
          fragments.forEach(f => { f.visible = false; });
        }
        // Guardian starts shifting to the side (right) at s=0.5
        if (s > 0.5) {
          const sideT = (s - 0.5) / 0.5;
          const easeSide = 1 - Math.pow(1 - sideT, 3);
          guardian.position.x = easeSide * 1.5;
          guardian.rotation.y = -easeSide * Math.PI / 8; // turn slightly to face the form
        }
      } else if (phase === "revealed") {
        // Guardian stays to the side. Subtle breath + pointer tracking.
        breathPhase += dt * 1.2;
        if (!reducedMotion) {
          const breath = Math.sin(breathPhase) * 0.04;
          guardian.position.y = -0.6 + breath;
          coreMat.emissiveIntensity = 1.2 + Math.sin(breathPhase * 1.5) * 0.35;
          // Pointer tracking — subtle parallax toward cursor
          const targetY = looksAway ? -Math.PI / 4 : pointerX * 0.25;
          const targetX = looksAway ? 0.1 : -pointerY * 0.1;
          guardian.rotation.y += (targetY - guardian.rotation.y) * 0.06;
          guardian.rotation.x += (targetX - guardian.rotation.x) * 0.06;
        }
      } else if (phase === "success") {
        successT += dt;
        const s = Math.min(successT / 1.2, 1.0);
        const ease = 1 - Math.pow(1 - s, 3);
        // Artifact (case) regrows at the guardian's position + brightens
        artifact.scale.setScalar(1 + ease * 2.5);
        artifact.position.y = 0.15 + ease * 0.4;
        caseMat.emissiveIntensity = 0.9 + ease * 1.5;
        coreMat.emissiveIntensity = 1.2 + ease * 1.5;
        guardian.rotation.y += (Math.PI / 6 - guardian.rotation.y) * 0.05;
        guardian.position.y = -0.6 + ease * 0.3;
        // Fade the figure itself out as the gateway takes over.
        guardianMat.opacity = Math.max(0.05, 0.96 - ease * 0.8);
        coreMat.opacity = Math.max(0.05, 0.85 - ease * 0.6);
      }

      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(tick);

    // For reduced-motion users, fire the reveal immediately so the
    // auth card appears instantly.
    if (reducedMotion) {
      fireReveal();
    }

    // Cleanup
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      silhouette.dispose();
      guardianMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      caseGeo.dispose();
      caseMat.dispose();
      doorMat.dispose();
      doorLightMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      fragmentGeo.dispose();
      fragments.forEach(f => (f.material as THREE.Material).dispose());
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      handleRef.current = null;
    };
  }, [accentColor, canvasColor, surfaceColor, reducedMotion, handleRef, onReveal]);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/** Build the guardian silhouette — a tall, slightly tapered, hooded
 *  form. Uses a lathe (a 2D profile rotated around the Y axis). */
function buildGuardianSilhouette(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.55, 0.00),
    new THREE.Vector2(0.62, 0.15),
    new THREE.Vector2(0.58, 0.30),
    new THREE.Vector2(0.48, 0.55),
    new THREE.Vector2(0.55, 0.85),
    new THREE.Vector2(0.52, 1.05),
    new THREE.Vector2(0.40, 1.20),
    new THREE.Vector2(0.32, 1.35),
    new THREE.Vector2(0.22, 1.48),
    new THREE.Vector2(0.10, 1.55),
    new THREE.Vector2(0.00, 1.60),
  ];
  const segments = 64;
  const geo = new THREE.LatheGeometry(profile, segments);
  geo.computeVertexNormals();
  return geo;
}
