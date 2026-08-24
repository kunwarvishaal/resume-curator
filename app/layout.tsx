import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Resume Curator — ATS-ready CV tailoring",
    template: "%s · Resume Curator",
  },
  description:
    "Upload your parent CV, match it to any job description, and export a 95+ ATS-targeted resume in LaTeX, DOCX, and PDF with AI grammar and vocabulary fixes.",
  applicationName: "Resume Curator",
  keywords: ["resume curator", "ATS resume", "CV tailoring", "LaTeX resume", "job description"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#03111e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
