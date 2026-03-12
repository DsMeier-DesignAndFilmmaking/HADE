import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HADE — Social Opportunity Matching",
  description:
    "One confident recommendation, not a list. The city is on your side tonight.",
  openGraph: {
    title: "HADE — Social Opportunity Matching",
    description:
      "Context-aware, trust-weighted decisions for urban moments.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${bricolage.variable} antialiased overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
