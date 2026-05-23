import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forklift AR Assist",
  description: "フォークリフト操作支援 ARダッシュボード",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
