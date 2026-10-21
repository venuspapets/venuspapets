'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { WarningDialog } from '@/components/WarningDialog';
import { getReminderStatus } from '@/app/(app)/recordatorios/actions';

const PROMPT_KEY = 'recordatorios-aviso';

/** Campana de recordatorios: titila mientras haya recordatorios nuevos sin revisar. Sin número. */
export function ReminderBell() {
  const pathname = usePathname();
  const router = useRouter();
  const [unseen, setUnseen] = useState(false);
  const [prompt, setPrompt] = useState(false);

  const refresh = useCallback(async () => {
    try { setUnseen((await getReminderStatus()).unseen); } catch { /* sin conexión: se reintenta luego */ }
  }, []);

  // Se revisa al entrar, al cambiar de pantalla, cuando la pantalla de recordatorios avisa y cada 5 minutos.
  useEffect(() => { refresh(); }, [pathname, refresh]);
  useEffect(() => {
    window.addEventListener('reminders-updated', refresh);
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => { window.removeEventListener('reminders-updated', refresh); clearInterval(timer); };
  }, [refresh]);

  const onPage = pathname.startsWith('/recordatorios');

  // Aviso flotante: una vez por sesión del navegador, y solo si hay recordatorios sin ver.
  useEffect(() => {
    if (!unseen || onPage) return;
    try { if (sessionStorage.getItem(PROMPT_KEY)) return; } catch { return; }
    setPrompt(true);
  }, [unseen, onPage]);

  const closePrompt = () => {
    setPrompt(false);
    try { sessionStorage.setItem(PROMPT_KEY, '1'); } catch { /* sin almacenamiento */ }
  };

  const ring = unseen && !onPage;
  return (
    <>
      <Link href="/recordatorios" className={ring ? 'bell ring' : 'bell'} title="Recordatorios"
        aria-label={ring ? 'Tienes recordatorios por revisar' : 'Recordatorios'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </Link>
      {prompt && (
        <WarningDialog
          title="Recordatorios por revisar"
          warnings={['Tienes recordatorios por enviar a tus clientes.']}
          question="¿Quieres revisarlos ahora?" confirmLabel="Ir" cancelLabel="Ver después" pending={false}
          onConfirm={() => { closePrompt(); router.push('/recordatorios'); }}
          onCancel={closePrompt}
        />
      )}
    </>
  );
}
