import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";

const giphurs = localFont({
  src: [
    { path: "./fonts/Giphurs-Variable.ttf", weight: "100 1000", style: "normal" },
    { path: "./fonts/Giphurs-Italic-Variable.ttf", weight: "100 1000", style: "italic" },
  ],
  variable: "--font-giphurs",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yuki: where trading value goes on NEAR",
  description:
    "On a chain that does not sell transaction order, who captures the value trading creates, and who pays for it? One week of NEAR mainnet, measured layer by layer.",
};

export const viewport: Viewport = {
  themeColor: "#0B0F12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={giphurs.variable}>
      <body>{children}</body>
    </html>
  );
}
