import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solutions Optispace CRM",
  description: "Industrial project CRM, commercial document and follow-up cockpit for Solutions Optispace.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
