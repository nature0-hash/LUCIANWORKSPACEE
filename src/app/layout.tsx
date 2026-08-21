import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import {
  ACCENT_IDS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  LEGACY_ACCENT_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  THEME_IDS,
  THEME_STORAGE_KEY,
} from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucian — Dashboard",
  description:
    "Lucian Workspace — a premium, themeable workspace shell with a GitHub-inspired layout.",
  icons: {
    icon: [
      { url: "/branding/lucian-workspace-icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/branding/lucian-workspace-icon.png", type: "image/png" },
    ],
    shortcut: "/branding/lucian-workspace-icon.png",
  },
};

const bootstrapScript = `
(function () {
  try {
    var themes = ${JSON.stringify(THEME_IDS)};
    var accents = ${JSON.stringify(ACCENT_IDS)};
    var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) || localStorage.getItem(${JSON.stringify(LEGACY_THEME_STORAGE_KEY)});
    var a = localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)}) || localStorage.getItem(${JSON.stringify(LEGACY_ACCENT_STORAGE_KEY)});
    document.documentElement.dataset.theme =
      themes.indexOf(t) >= 0 ? t : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.dataset.accent =
      accents.indexOf(a) >= 0 ? a : ${JSON.stringify(DEFAULT_ACCENT)};
  } catch (e) {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.dataset.accent = ${JSON.stringify(DEFAULT_ACCENT)};
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-accent={DEFAULT_ACCENT}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
