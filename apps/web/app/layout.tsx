import "./globals.css";
import type { Metadata } from "next";
import { getPublicBranding } from "@/lib/publicBranding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBranding();
  const companyName = branding.companyName || "Company HR Portal";
  return {
    title: companyName,
    description: `${companyName} dashboard`
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
