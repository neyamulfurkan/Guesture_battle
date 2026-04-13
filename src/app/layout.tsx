import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import './globals.css'

const inter = Inter({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const ToastContainer = dynamic(
  () => import('@/components/ui/Toast').then((mod) => mod.ToastContainer),
  { ssr: false }
)

export const metadata: Metadata = {
  title: 'GestureBattle',
  description: 'Fight your friends. No controllers. Just your hands, your voice, and your face.',
  themeColor: '#050810',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.variable} bg-bg-base text-white min-h-screen`}>
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}