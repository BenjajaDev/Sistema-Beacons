import { useQuery } from "@tanstack/react-query";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { Img, VozDeImagen } from "../components";
import { consultas } from "../data";
import { PaginaSecciones } from "../sections";

function Fotos() {
  const { data, isPending, error, refetch } = useQuery(consultas.galeria());
  if (isPending) {
    return (
      <Cargando etiqueta="Cargando la galería…">
        <div className="galeria">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} alto="14rem" />
          ))}
        </div>
      </Cargando>
    );
  }
  if (error) return <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />;
  if (data.items.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay fotos"
        texto="Vuelve pronto para ver los momentos del proyecto."
      />
    );
  }
  return (
    <ul className="galeria">
      {data.items.map((f, i) => (
        <li key={`${i}-${f.name}`}>
          <figure className="galeria__foto">
            <div className="con-voz">
              <Img imagen={f.image} className="galeria__imagen" />
              <VozDeImagen imagen={f.image} />
            </div>
            <figcaption>
              <span className="galeria__pie">{f.name}</span>
              {f.credit && <span className="galeria__credito">{f.credit}</span>}
              <a href={f.image.url} target="_blank" rel="noopener noreferrer">
                {"Ver en tamaño completo "}
                <span className="visually-hidden">{` la foto «${f.name}» (se abre en una pestaña nueva)`}</span>
              </a>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

export default function Galeria() {
  return (
    <PaginaSecciones slug="galeria" tituloRespaldo="Galería">
      <div className="container seccion">
        <Fotos />
      </div>
    </PaginaSecciones>
  );
}
