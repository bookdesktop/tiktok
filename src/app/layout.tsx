import type { Metadata } from "next";
import { kanit, pixel } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "งานวัด Pixel Live",
  description: "เกมงานวัดสำหรับ TikTok Live — ผู้ชมเข้ามาแล้วมีตัวละครเดินเล่นในงาน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${kanit.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
