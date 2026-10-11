import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import SitewideNotice from "@/components/notices/SitewideNotice";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LegacyLink",
  description:
    "A family connection platform for stories, memories, and the people who made you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<SitewideNotice /></body>
    </html>
  );
}
