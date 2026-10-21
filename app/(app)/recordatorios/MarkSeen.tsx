'use client';

import { useEffect } from 'react';
import { markRemindersSeen } from './actions';

/** Al entrar a la pantalla, los recordatorios pendientes quedan vistos y la campana deja de titilar. */
export function MarkSeen() {
  useEffect(() => {
    markRemindersSeen().finally(() => window.dispatchEvent(new Event('reminders-updated')));
  }, []);
  return null;
}
