import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/mhr/providers";

export const metadata: Metadata = {
  title: "MHR | پنل مدیریت شخصی",
  description: "پنل مدیریت شخصی MHR — داشبورد منابع، مدیریت کاربران، اینباندها و صفحه اشتراک",
  applicationName: "MHR",
  icons: {
    icon: "/mhr-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef5fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1524" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
