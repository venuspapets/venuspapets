import { novaStudioLink } from '@/lib/contact';

export function Footer() {
  return (
    <footer className="site-footer">
      Desarrollado por{' '}
      <a href={novaStudioLink} target="_blank" rel="noopener noreferrer">NovaStudio</a>
    </footer>
  );
}
