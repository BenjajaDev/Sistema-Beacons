import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { adminFetch, type Beacon, type Noticia, type Pagina, type Seccion } from "../api";
import { useAuth } from "../auth";
import { Cabecera, formatoFecha, usePanelPage } from "../ui";

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta-panel" aria-label={titulo}>
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}

function ListaNoticias({ filtro, vacio }: { filtro: string; vacio: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "noticias", "resumen", filtro],
    queryFn: () => adminFetch<Pagina<Noticia>>(`/news?limit=5&${filtro}`),
  });
  if (isPending)
    return (
      <Cargando>
        <Skeleton alto="4rem" />
      </Cargando>
    );
  if (error) return <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />;
  if (!data.items.length) return <p className="texto-suave">{vacio}</p>;
  return (
    <ul className="lista-simple">
      {data.items.map((n) => (
        <li key={n.id}>
          <Link to={`/noticias/${n.id}`}>{n.title}</Link>
          <span className="texto-suave">
            {" "}
            · {n.author.name} · {formatoFecha(n.updatedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Resumen() {
  const { usuario, tiene } = useAuth();
  const h1 = usePanelPage("Resumen");
  const admin = tiene("ADMIN");

  const secciones = useQuery({
    queryKey: ["admin", "secciones"],
    queryFn: () => adminFetch<{ items: Seccion[] }>("/sections"),
  });
  const beacons = useQuery({
    queryKey: ["admin", "beacons"],
    queryFn: () =>
      adminFetch<{
        items: Beacon[];
        resumen: { total: number; completos: number; incompletos: number };
      }>("/beacons"),
    enabled: admin,
  });
  const mensajes = useQuery({
    queryKey: ["admin", "mensajes", "no-leidos"],
    queryFn: () => adminFetch<{ noLeidos: number }>("/messages?limit=1&noLeidos=true"),
    enabled: admin,
  });

  const pendientes = secciones.data?.items.filter((s) => s.draftStatus) ?? [];

  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Resumen"
        descripcion={`Hola, ${usuario?.name}. Esto es lo que tienes pendiente.`}
        acciones={
          <Link to="/noticias/nueva" className="btn btn--primario">
            Nueva noticia
          </Link>
        }
      />
      <div className="rejilla-panel">
        {admin ? (
          <Tarjeta titulo="Noticias por revisar">
            <ListaNoticias filtro="status=REVIEW" vacio="No hay noticias esperando revisión." />
          </Tarjeta>
        ) : (
          <>
            <Tarjeta titulo="Mis borradores">
              <ListaNoticias
                filtro="status=DRAFT&mias=true"
                vacio="No tienes borradores. Crea una noticia nueva para empezar."
              />
            </Tarjeta>
            <Tarjeta titulo="Mis notas en revisión">
              <ListaNoticias
                filtro="status=REVIEW&mias=true"
                vacio="No tienes notas esperando revisión."
              />
            </Tarjeta>
          </>
        )}

        <Tarjeta titulo="Secciones con cambios pendientes">
          {secciones.isPending ? (
            <Cargando>
              <Skeleton alto="4rem" />
            </Cargando>
          ) : secciones.error ? (
            <ErrorState
              mensaje={mensajeDeError(secciones.error)}
              onReintentar={() => secciones.refetch()}
            />
          ) : pendientes.length === 0 ? (
            <p className="texto-suave">Todo lo publicado está al día.</p>
          ) : (
            <ul className="lista-simple">
              {pendientes.map((s) => (
                <li key={s.key}>
                  <Link to={`/secciones/${s.key}`}>{s.nombre}</Link>
                  <span className="texto-suave">
                    {" "}
                    · {s.draftStatus === "REVIEW" ? "en revisión" : "borrador"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {admin && (
          <>
            <Tarjeta titulo="Mensajes de contacto">
              {mensajes.data ? (
                <p>
                  <strong className="cifra">{mensajes.data.noLeidos}</strong> sin leer.{" "}
                  <Link to="/contacto">Ver mensajes</Link>
                </p>
              ) : mensajes.error ? (
                <ErrorState
                  mensaje={mensajeDeError(mensajes.error)}
                  onReintentar={() => mensajes.refetch()}
                />
              ) : (
                <Cargando>
                  <Skeleton alto="2rem" />
                </Cargando>
              )}
            </Tarjeta>
            <Tarjeta titulo="Beacons">
              {beacons.data ? (
                beacons.data.resumen.total === 0 ? (
                  <EmptyState
                    titulo="No hay beacons registrados"
                    accion={
                      <Link to="/beacons" className="btn btn--secundario">
                        Registrar un beacon
                      </Link>
                    }
                  />
                ) : (
                  <p>
                    <strong className="cifra">{beacons.data.resumen.completos}</strong> de{" "}
                    {beacons.data.resumen.total} fichas completas.{" "}
                    {beacons.data.resumen.incompletos > 0 && (
                      <Link to="/beacons">
                        Completar las {beacons.data.resumen.incompletos} que faltan
                      </Link>
                    )}
                  </p>
                )
              ) : beacons.error ? (
                <ErrorState
                  mensaje={mensajeDeError(beacons.error)}
                  onReintentar={() => beacons.refetch()}
                />
              ) : (
                <Cargando>
                  <Skeleton alto="2rem" />
                </Cargando>
              )}
            </Tarjeta>
          </>
        )}
      </div>
    </div>
  );
}
