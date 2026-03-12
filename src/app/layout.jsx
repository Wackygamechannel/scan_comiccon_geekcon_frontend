import "./globals.css";

export const metadata = {
  title: "Scan ComicCon GeekCon Frontend",
  description: "Mobile-first ticket scanner dashboard for ComicCon x GeekCon",
  icons: {
    icon: "/scanner-favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
