import "./globals.css";

export const metadata = {
  title: "Clipboard PIN Relay",
  description: "Temporary clipboard relay with optional PIN-based encryption.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
