import type { Metadata } from 'next';

import { Providers } from './providers';

import './global.css';

export const metadata: Metadata = {
  title: 'CED Adhesion — Upload signed agreement',
  description:
    'Pilot upload form for the CED adhesion signed agreement (step 1).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
