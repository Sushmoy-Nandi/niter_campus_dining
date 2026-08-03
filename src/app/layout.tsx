import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/layout/providers"
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants"

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
}

export const viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
