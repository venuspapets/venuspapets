'use client';

import { useEffect } from 'react';

/** Cuadro flotante de aviso no bloqueante: el usuario decide si continúa o corrige. */
export function WarningDialog({ warnings, question, confirmLabel, cancelLabel, pending, onConfirm, onCancel }: {
  warnings: string[]; question: string; confirmLabel: string; cancelLabel: string;
  pending: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  // Esc equivale a "corregir".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="warn-title" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <img src="/gato.svg" alt="" width={48} height={48} />
          <h2 id="warn-title">Antes de continuar</h2>
        </div>
        <ul>{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        <p><strong>{question}</strong></p>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
