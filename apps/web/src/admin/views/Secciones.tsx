import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { mensajeDeError } from "@shared/api";
import { IconButton } from "@shared/ui/Button";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Seccion } from "../api";
import { useAuth } from "../auth";
import { Cabecera, Interruptor, usePanelPage } from "../ui";

const PAGINAS: { valor: Seccion["page"]; texto: string }[] = [
  { valor: "INICIO", texto: "Inicio" },
  { valor: "NOSOTROS", texto: "Nosotros" },
  { valor: "NOTICIAS", texto: "Noticias" },
  { valor: "CONTACTO", texto: "Contacto" },
];

export function estadoSeccion(s: Seccion) {
  if (s.draftStatus === "REVIEW") return "Cambios en revisión";
  if (s.draftStatus === "DRAFT") return "Cambios sin publicar";
  return "Publicada";
}

export default function Secciones() {
  const h1 = usePanelPage("Secciones");
  const { tiene } = useAuth();
  const admin = tiene("ADMIN");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [anuncio, setAnuncio] = useState("");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "secciones"],
    queryFn: () => adminFetch<{ items: Seccion[] }>("/sections"),
  });

  const visibilidad = useMutation({
    mutationFn: ({ key, visible }: { key: string; visible: boolean }) =>
      adminFetch(`/sections/${key}/visibility`, { method: "PATCH", body: { visible } }),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "secciones"] });
      toast.exito(
        v.visible
          ? "La sección ahora se muestra en el sitio."
          : "La sección quedó oculta en el sitio.",
      );
    },
    onError: (err) => toast.error(`No se pudo cambiar la visibilidad. ${mensajeDeError(err)}`),
  });

  const orden = useMutation({
    mutationFn: ({ page, keys }: { page: string; keys: string[] }) =>
      adminFetch("/sections/order", { method: "PUT", body: { page, keys } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "secciones"] }),
    onError: (err) => toast.error(`No se pudo cambiar el orden. ${mensajeDeError(err)}`),
  });

  function mover(lista: Seccion[], indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    const keys = lista.map((s) => s.key);
    [keys[indice], keys[destino]] = [keys[destino]!, keys[indice]!];
    orden.mutate({ page: lista[indice]!.page, keys });
    setAnuncio(`«${lista[indice]!.nombre}» ahora es la sección ${destino + 1} de ${lista.length}.`);
  }

  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Secciones"
        descripcion={
          admin
            ? "Edita los textos de cada página, elige qué secciones se muestran y en qué orden."
            : "Edita los textos de cada página. Tus cambios se publican cuando una persona administradora los aprueba."
        }
      />
      <p className="visually-hidden" role="status">
        {anuncio}
      </p>
      {isPending ? (
        <Cargando etiqueta="Cargando secciones…">
          <Skeleton alto="16rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : (
        PAGINAS.map((p) => {
          const lista = data.items
            .filter((s) => s.page === p.valor)
            .sort((a, b) => a.order - b.order);
          if (!lista.length) return null;
          return (
            <section
              key={p.valor}
              className="grupo-secciones"
              aria-labelledby={`pagina-${p.valor}`}
            >
              <h2 id={`pagina-${p.valor}`}>Página {p.texto}</h2>
              <ol className="lista-secciones">
                {lista.map((s, i) => (
                  <li key={s.key} className="fila-seccion">
                    <div className="fila-seccion__info">
                      <Link to={`/secciones/${s.key}`}>{s.nombre}</Link>
                      <span className={`texto-suave ${s.draftStatus ? "texto-aviso" : ""}`}>
                        {estadoSeccion(s)}
                        {!s.visible && " · oculta en el sitio"}
                      </span>
                    </div>
                    {admin && (
                      <div className="fila-seccion__acciones">
                        <Interruptor
                          activo={s.visible}
                          etiqueta={`Visible: ${s.nombre}`}
                          ocupado={visibilidad.isPending && visibilidad.variables?.key === s.key}
                          onCambiar={(visible) => visibilidad.mutate({ key: s.key, visible })}
                        />
                        <IconButton
                          label={`Subir «${s.nombre}»`}
                          aria-disabled={i === 0 || undefined}
                          onClick={() => mover(lista, i, -1)}
                        >
                          <span aria-hidden="true">↑</span>
                        </IconButton>
                        <IconButton
                          label={`Bajar «${s.nombre}»`}
                          aria-disabled={i === lista.length - 1 || undefined}
                          onClick={() => mover(lista, i, 1)}
                        >
                          <span aria-hidden="true">↓</span>
                        </IconButton>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
