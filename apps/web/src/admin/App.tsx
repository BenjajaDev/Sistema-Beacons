import { usePage } from "@shared/a11y/focus";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
import { ToastProvider } from "@shared/ui/Toast";

// Esqueleto del panel (fase 4). Login, sidebar y vistas llegan en la fase 6.
export function App() {
  const h1 = usePage("Panel");
  return (
    <ToastProvider>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="container">
        <ThemeSwitcher />
        <TextSizeControl />
      </header>
      <main id="contenido" className="container" tabIndex={-1}>
        <h1 ref={h1} tabIndex={-1}>
          Panel de SIGNAL
        </h1>
      </main>
    </ToastProvider>
  );
}
