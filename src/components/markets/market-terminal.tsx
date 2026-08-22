"use client";

// LUCIAN Market Terminal — BLANK SLATE.
//
// Per request, the entire Markets section has been cleared. No instruments,
// no chart, no trading panel, no intelligence panel, no tool rail, no
// account bar. The component intentionally renders nothing but the empty
// canvas so the rest of the workspace can be viewed with the market as a
// truly empty slate.

export function MarketTerminal() {
  return (
    <div
      aria-label="Markets (empty)"
      className="flex h-full w-full items-center justify-center bg-[#13161c] text-white"
    >
      {/* intentionally blank */}
    </div>
  );
}
