import { usePage } from "@shared/a11y/focus";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
import { ToastProvider } from "@shared/ui/Toast";

// Esqueleto de la landing (fase 4). Las páginas reales llegan en la fase 5.
export function App() {
  const h1 = usePage("SIGNAL");
  return (
    <ToastProvider>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="container">
        <nav aria-label="Principal">
          <a href="/">SIGNAL</a>
        </nav>
        <ThemeSwitcher />
        <TextSizeControl />
      </header>
      <main id="contenido" className="container" tabIndex={-1}>
        <h1 ref={h1} tabIndex={-1}>
          SIGNAL
        </h1>
        <p className="prosa">Navegación interior accesible con beacons Bluetooth.</p>
      </main>
    </ToastProvider>
  );
}
