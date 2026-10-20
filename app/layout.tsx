import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'VenuSpa Pets',
  description: 'Sistema de administración — Peluquería Canina',
  icons: { icon: '/logo.png' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="page">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
