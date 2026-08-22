"use client";

import Link from "next/link";

export function PageShell({
  children,
  width = "default",
}: {
  children: React.ReactNode;
  width?: "default" | "narrow" | "full";
}) {
  const maxW =
    width === "narrow"
      ? "max-w-3xl"
      : width === "full"
        ? "max-w-full"
        : "max-w-5xl";
  return (
    <div className="themed min-h-screen w-full bg-canvas text-fg">
      <div className={`mx-auto ${maxW} px-6 py-8`}>{children}</div>
    </div>
  );
}
