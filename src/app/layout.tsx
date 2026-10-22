import type { Metadata } from "next";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "./globals.css";

export const metadata: Metadata = {
  title: "云南白药集团 · 数据门户",
  description: "数据驱动经营 · 智慧赋能决策",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: "#2878D4",
              borderRadius: 8,
            },
            components: {
              Breadcrumb: {
                lastItemColor: "rgba(10, 12, 16, 0.84)",
                separatorColor: "#999",
              },
              Input: {
                colorBorder: "rgba(40, 120, 212, 0.3)",
                colorPrimaryHover: "rgba(40, 120, 212, 0.8)",
              },
              Tabs: {
                inkBarColor: "#2878D4",
                itemActiveColor: "#2878D4",
                itemHoverColor: "rgba(40, 120, 212, 0.8)",
              },
            },
          }}
        >
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
