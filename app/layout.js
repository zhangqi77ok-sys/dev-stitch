import "./globals.css";

export const metadata = {
  title: "Dev Stitch — Multi-Agent Triage Console",
  description:
    "Stitches public GitHub repos, RSS feeds and local docs into one prioritized action queue.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
