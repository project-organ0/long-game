import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://janggi-defense.cokung.chatgpt.site"),
  title: "장기전 | 세포 진화 디펜스",
  description: "미분화 세포를 심고 폐·간·심장 세포로 진화시켜 몸속 침입자를 막는 디펜스 게임",
  openGraph: {
    title: "장기전",
    description: "세포를 심고, 몸을 지켜라",
    images: ["/og.png"],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
