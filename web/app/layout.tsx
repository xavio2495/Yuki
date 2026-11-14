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
  themeColor: "#05070A",
};

// dark is the default; a saved light choice is applied before first paint (no flash)
const THEME = `try{if(localStorage.getItem("yuki-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={giphurs.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
