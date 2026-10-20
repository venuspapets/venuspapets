/** Título de la página con un texto que explica qué se puede hacer en ella. */
export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p className="help">{description}</p>
    </header>
  );
}
