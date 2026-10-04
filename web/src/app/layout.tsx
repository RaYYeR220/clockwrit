import type {Metadata} from 'next'
import {DM_Mono, Fraunces} from 'next/font/google'
import {SiteNav} from '@/components/site-nav'
import './globals.css'

const serif = Fraunces({subsets: ['latin'], axes: ['opsz'], variable: '--font-serif', display: 'swap'})
const mono = DM_Mono({subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap'})

export const metadata: Metadata = {
  title: {default: 'Clockwrit — what time is it, legally?', template: '%s · Clockwrit'},
  description:
    'An agent that reads the law, IANA tzdata and your runtime’s clock, and tells you which one is right — with the decree, the date and the source quote.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
