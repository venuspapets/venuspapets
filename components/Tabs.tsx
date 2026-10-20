'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="tabs">
      {items.map(i => (
        <Link key={i.href} href={i.href} className={path === i.href ? 'tab active' : 'tab'}>{i.label}</Link>
      ))}
    </nav>
  );
}
