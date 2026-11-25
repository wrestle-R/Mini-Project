import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkerProvider } from "@/contexts/WorkerContext";
import { ContractorProvider } from "@/contexts/ContractorContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { GoogleTranslateProvider } from "@/components/shared/google-translate";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "InfraSaathi - Construction Field Management",
  description:
    "Digitize your construction site operations with InfraSaathi. Manage projects, tasks, DPRs, attendance, materials, and invoicing in one platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WorkerProvider>
            <ContractorProvider>
              <CompanyProvider>
                <TooltipProvider>
                  {children}
                </TooltipProvider>
                <GoogleTranslateProvider />
              </CompanyProvider>
            </ContractorProvider>
          </WorkerProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
