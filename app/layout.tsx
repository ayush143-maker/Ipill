import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "India Family Planning Atlas | NFHS-5",
  description:
    "Interactive, state-level visualization of contraceptive method use across India, sourced from NFHS-5 (2019–21).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B0B12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg font-sans text-text-primary antialiased">{children}</body>
    </html>
  );
}
