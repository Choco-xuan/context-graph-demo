import type { Metadata } from "next";
import { Provider } from "@/components/ui/provider";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "本体洞察",
  description: "AI-powered decision tracing with Neo4j context graphs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning style={{ height: "100%" }}>
      <body style={{ margin: 0, height: "100%", overflow: "hidden" }}>
        <Provider>{children}</Provider>
        <Analytics />
      </body>
    </html>
  );
}
