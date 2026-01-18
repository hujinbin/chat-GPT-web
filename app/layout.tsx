import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
// import "antd/dist/antd.css";
import AntdContainer from '@/components/AntdContainer'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Heaven.ai - 帮你看更大的世界",
  description: "Heaven.ai 是一个有着超大“内存”的智能助手，可以一口气读完二十万字的小说，还会上网冲浪，快来跟他聊聊吧 | Heaven.ai 出品的智能助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          id="adsense-init"
          async
          strategy="afterInteractive"
          data-ad-client="ca-pub-7979174285252748"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
        />
      </head>
      <body className={inter.className}>
        <AntdContainer>{children}</AntdContainer>
      </body>
    </html>
  );
}
