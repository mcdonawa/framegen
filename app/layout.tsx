import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Eyedia Media — AI Creative Studio",
  description: "Generate video, images, audio, and 3D with the latest AI models",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${bebasNeue.variable} ${dmSans.variable}`}
        style={{
          margin: 0,
          padding: 0,
          background: "#08080B",
          color: "#F2F2F7",
          fontFamily: "var(--font-body), sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
      </body>
    </html>
  );
}
