import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iNail NBTI",
  description: "손톱으로 보는 성격 테스트",
  other: {
    "color-scheme": "light only",
    "supported-color-schemes": "light",
    "format-detection": "telephone=no", // 전화번호 자동 링크 방지
  },
};

// [줌 방지 & 테마 컬러 고정]
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 핀치 줌 방지 (버튼 확대 방지)
  themeColor: "#fffffe", // 상단바 색상도 오프-화이트로 설정
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      {/* 배경색 대신 그라데이션 이미지 강제 주입 */}
      <body style={{ 
        backgroundImage: 'linear-gradient(to bottom, #ffffff, #ffffff)', 
        color: '#222222' 
      }}>
        {children}
      </body>
    </html>
  );
}