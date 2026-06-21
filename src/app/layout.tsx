import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rune",
  description:
    "Zero-knowledge encrypted workspaces. Write freely behind AES-256 encryption with dual-password access, self-destruct timers, and a 3D knowledge graph. Nothing leaves your browser unencrypted.",
  keywords: [
    "encrypted notepad",
    "secure notes",
    "anonymous notepad",
    "password protected notes",
    "zero knowledge notes",
    "encrypted text",
    "rune",
    "self destruct notes",
  ],
  icons: {
    icon: "/rune-logo.svg",
  },
  authors: [{ name: "Rune" }],
  openGraph: {
    title: "Rune",
    description:
      "Zero-knowledge encrypted workspaces. Dual passwords, self-destruct, 3D knowledge graph.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mesh-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
