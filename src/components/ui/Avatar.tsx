"use client";

interface AvatarProps {
  size?: number;
  className?: string;
}

/**
 * Original placeholder avatar — an accent-tinted disc with initials.
 */
export function Avatar({ size = 32, className = "" }: AvatarProps) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={`themed inline-flex select-none items-center justify-center rounded-full border border-line bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] font-semibold text-fg ${className}`}
    >
      LM
    </span>
  );
}
