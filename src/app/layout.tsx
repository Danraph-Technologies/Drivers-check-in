import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://check-in.ecocruise.org'),
  applicationName: 'DanRaph Trip Report',
  title: {
    default: 'DanRaph Trip Report',
    template: '%s | DanRaph Trip Report',
  },
  description: 'Trip reports for DanRaph Transport drivers and management.',
  openGraph: {
    type: 'website',
    siteName: 'DanRaph Trip Report',
    title: 'DanRaph Trip Report',
    description:
      'Drivers file trip reports from the road. Management sees who loaded, the seats, and the money.',
    url: 'https://check-in.ecocruise.org',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DanRaph Integrated Services - Driver Trip Report',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DanRaph Trip Report',
    description: 'Trip reports for DanRaph Transport drivers and management.',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // prevent iOS input zoom
  themeColor: '#044dae',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}