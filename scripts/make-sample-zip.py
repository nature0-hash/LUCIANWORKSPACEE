"""
Generate a sample project ZIP to test the Lucian Project Library import flow.
"""
import zipfile
from pathlib import Path

OUT = Path("/home/z/my-project/scripts/sample-project.zip")
OUT.parent.mkdir(parents=True, exist_ok=True)

# A realistic small Next.js-like project layout, wrapped in a single
# top-level folder (the typical "download from a generator" shape).
FILES = {
    "sample-app/package.json": """{
  "name": "sample-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0"
  }
}
""",
    "sample-app/README.md": """# Sample App

This is a sample project used to test the Lucian Workspace Project Library
import flow.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.
""",
    "sample-app/next.config.ts": """import type { NextConfig } from \"next\";

const nextConfig: NextConfig = {};

export default nextConfig;
""",
    "sample-app/tsconfig.json": """{
  "compilerOptions": {
    "target": "ES2017",
    "lib": [\"dom\", \"dom.iterable\", \"esnext\"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": \"esnext\",
    "moduleResolution": \"bundler\",
    "jsx": \"preserve\",
    "incremental": true
  },
  "include\": [\"next-env.d.ts\", \"**/*.ts\", \"**/*.tsx\"]
}
""",
    "sample-app/.gitignore": """node_modules/
.next/
out/
build/
*.log
.env
.env.local
""",
    "sample-app/src/app/layout.tsx": """import type { Metadata } from \"next\";
import \"./globals.css\";

export const metadata: Metadata = {
  title: \"Sample App\",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang=\"en\">
      <body>{children}</body>
    </html>
  );
}
""",
    "sample-app/src/app/page.tsx": """export default function Page() {
  return (
    <main>
      <h1>Hello from Sample App</h1>
    </main>
  );
}
""",
    "sample-app/src/app/globals.css": """* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }
""",
    "sample-app/src/components/Button.tsx": """interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button onClick={onClick} className=\"btn\">
      {children}
    </button>
  );
}
""",
    "sample-app/public/logo.svg": """<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\">
  <rect width=\"100\" height=\"100\" fill=\"#000\"/>
  <text x=\"50\" y=\"55\" font-size=\"14\" text-anchor=\"middle\" fill=\"#fff\">Logo</text>
</svg>
""",
}


def main() -> None:
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in FILES.items():
            zf.writestr(path, content)
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print("Contents:")
    with zipfile.ZipFile(OUT, "r") as zf:
        for info in zf.infolist():
            print(f"  {info.filename:50s} {info.file_size:>6} bytes")


if __name__ == "__main__":
    main()
