const CARLINI_TOOLS_URL = 'https://www.carlinitools.com/';

export function PublicMenuFooter() {
  return (
    <footer className="public-menu-footer">
      <a href={CARLINI_TOOLS_URL} target="_blank" rel="noopener noreferrer">
        Diseñado por CarliniTools
      </a>
    </footer>
  );
}
