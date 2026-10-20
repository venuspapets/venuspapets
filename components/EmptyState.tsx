/** Mensaje para cuando una sección todavía no tiene datos, acompañado de una mascota. */
export function EmptyState({ title, children, pet = 'perro' }: { title: string; children: React.ReactNode; pet?: 'perro' | 'gato' }) {
  return (
    <div className="empty">
      <img src={`/${pet}.svg`} alt="" width={72} height={72} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
