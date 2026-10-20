import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VenuSpa Pets',
  description: 'Sistema de administración — Peluquería Canina',
  icons: { icon: '/logo.png' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
