'use client';

import { useState } from 'react';

export function PasswordInput({ id, name, label, autoComplete, placeholder }: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} required />
        <button type="button" className="password-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}
