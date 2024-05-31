import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className={inter.className}>
        <AntdContainer>{children}</AntdContainer>
      </body>
    </html>
  );
}
