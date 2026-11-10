import { useId } from "react";
import { ThemeSwitcher } from "@shared/theme/Controls";
import {
  aplicarFuente,
  aplicarGuia,
  fuenteGuardada,
  guiaGuardada,
  restablecerPreferencias,
  usePreferencia,
  type FuentePreferida,
} from "@shared/theme/preferences";
import { Button } from "@shared/ui/Button";
import { Conmutador } from "@shared/ui/Conmutador";

// Panel «Accesibilidad» del encabezado: todo lo que la propuesta pide para
// personas con baja visión, dislexia o fatiga visual, en un solo lugar. Va en el
// flujo de la página (no flota): con zoom, en móvil o con texto grande no tapa
// contenido y se recorre con Tab en orden. El zoom de la página queda fuera, a la
// vista en el encabezado, para poder deshacerlo aunque el menú esté plegado.
export function PanelAccesibilidad({
  id,
  abierto,
  onCerrar,
}: {
  id: string;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const titulo = useId();
  const fuente = usePreferencia<FuentePreferida>(fuenteGuardada);
  const guia = usePreferencia<boolean>(guiaGuardada);

  return (
    <section id={id} className="panel-accesibilidad" aria-labelledby={titulo} hidden={!abierto}>
      <div className="container panel-accesibilidad__cuerpo">
        <h2 id={titulo} className="panel-accesibilidad__titulo">
          Accesibilidad
        </h2>
        <p className="panel-accesibilidad__intro">
          Ajusta cómo se ve el sitio. Tus elecciones se recuerdan en este navegador.
        </p>
        <div className="panel-accesibilidad__rejilla">
          <ThemeSwitcher conTexto altoContraste />
          <Conmutador
            etiqueta="Fuente para dislexia"
            ayuda="Cambia las letras por OpenDyslexic, de trazo más pesado en la base."
            activo={fuente === "dislexia"}
            onCambiar={(activo) => aplicarFuente(activo ? "dislexia" : "normal")}
          />
          <Conmutador
            etiqueta="Guía de lectura"
            ayuda="Oscurece la página y deja una franja clara que sigue al puntero o al foco."
            activo={guia}
            onCambiar={aplicarGuia}
          />
        </div>
        <div className="panel-accesibilidad__acciones">
          <Button variante="secundario" onClick={restablecerPreferencias}>
            Restablecer todo
          </Button>
          <Button variante="fantasma" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </section>
  );
}
