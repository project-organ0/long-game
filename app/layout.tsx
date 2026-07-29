import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "장기전 | 하루 생존 디펜스",
  description: "몸속으로 침투하는 나쁜 생활 습관을 막는 캐주얼 장기 디펜스 게임",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
