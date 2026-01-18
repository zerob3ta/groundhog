import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Punxsutawney Phil LIVE',
  description: 'Chat with the world\'s most famous groundhog - live from Gobbler\'s Knob!',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Punxsutawney Phil LIVE',
    description: 'Chat with the world\'s most famous groundhog - live from Gobbler\'s Knob!',
    images: ['/phil.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
