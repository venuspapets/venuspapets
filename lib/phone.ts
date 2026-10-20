/** Deja solo dígitos y agrega el 57 de Colombia a un celular de 10 dígitos. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('3') ? '57' + digits : digits;
}

export function whatsappUrl(phone: string, message = '') {
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
