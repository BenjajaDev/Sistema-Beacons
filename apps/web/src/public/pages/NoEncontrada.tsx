import { Link } from "react-router";
import { useTituloPagina } from "../data";

export default function NoEncontrada() {
  const refH1 = useTituloPagina("Página no encontrada");
  return (
    <div className="container seccion no-encontrada">
      <h1 ref={refH1} tabIndex={-1}>
        No encontramos esta página
      </h1>
      <p>Puede que la dirección esté mal escrita o que el contenido se haya movido.</p>
      <p>
        <Link to="/" className="btn btn--primario">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
