import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ConfirmDialog } from "@shared/ui/Dialog";
import { SelectField } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Suscriptor } from "../api";
import { Cabecera, formatoFecha, usePanelPage } from "../ui";

// Personas que pidieron recibir el boletín. Desde aquí no se envía nada: se descarga
// la lista de quienes siguen suscritos (con el enlace de baja de cada una) para usarla
// en la herramienta de correo del equipo.

type Estado = "activos" | "bajas" | "todos";

export default function Suscriptores() {
  const h1 = usePanelPage("Suscriptores");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>("activos");
  const [borrando, setBorrando] = useState<Suscriptor | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["admin", "suscriptores", estado],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      adminFetch<{
        items: Suscriptor[];
        nextCursor: string | null;
        resumen: { activos: number; bajas: number };
      }>(`/subscribers?limit=30&estado=${estado}${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (u) => u.nextCursor,
  });
  const resumen = consulta.data?.pages[0]?.resumen;
  const items = consulta.data?.pages.flatMap((p) => p.items) ?? [];
  const borrar = useMutation({
    mutationFn: (id: string) => adminFetch(`/subscribers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.exito("Suscripción eliminada.");
      queryClient.invalidateQueries({ queryKey: ["admin", "suscriptores"] });
    },
    onError: (err) => toast.error(`No se pudo eliminar. ${mensajeDeError(err)}`),
  });

  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Suscriptores"
        descripcion="Personas que aceptaron recibir el boletín desde el formulario del sitio. Son datos personales: úsalos solo para enviar el boletín."
      />
      <section className="tarjeta-panel" aria-labelledby="suscriptores-lista">
        <div className="vista-cabecera">
          <h2 id="suscriptores-lista">
            Lista{" "}
            {resumen && (
              <span className="contador">
                {resumen.activos} {resumen.activos === 1 ? "activa" : "activas"}
              </span>
            )}
          </h2>
          <SelectField
            label="Mostrar"
            value={estado}
            onChange={(e) => setEstado(e.target.value as Estado)}
            className="filtro-motivo"
          >
            <option value="activos">Suscritas ({resumen?.activos ?? "…"})</option>
            <option value="bajas">Dadas de baja ({resumen?.bajas ?? "…"})</option>
            <option value="todos">Todas</option>
          </SelectField>
          {/* Un enlace y no un botón: es una descarga del servidor con la sesión actual. */}
          <a href="/api/admin/subscribers/export" className="btn btn--secundario" download>
            Descargar suscritas (CSV)
          </a>
        </div>
        <p className="campo__ayuda">
          El archivo trae el correo, el nombre, la fecha del consentimiento y el enlace de baja de
          cada persona. Incluye ese enlace en cada envío: sin él no se cumple el derecho a darse de
          baja.
        </p>
        {consulta.isPending ? (
          <Cargando etiqueta="Cargando suscriptores…">
            <Skeleton alto="8rem" />
          </Cargando>
        ) : consulta.error ? (
          <ErrorState
            mensaje={mensajeDeError(consulta.error)}
            onReintentar={() => consulta.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            titulo="Todavía no hay suscripciones"
            texto="Cuando alguien se suscriba desde el sitio, aparecerá aquí. Recuerda mostrar la sección «Boletín» desde Secciones."
          />
        ) : (
          <ul className="lista-secciones">
            {items.map((s) => (
              <li key={s.id} className="fila-seccion">
                <div className="fila-seccion__info">
                  <strong>{s.email}</strong>
                  <span className="texto-suave">
                    {s.name ? `${s.name} · ` : ""}
                    Aceptó el {formatoFecha(s.consentAt)}
                    {/* El estado se dice con texto, no solo con la ubicación en la lista. */}
                    {s.unsubscribedAt
                      ? ` · Se dio de baja el ${formatoFecha(s.unsubscribedAt)}`
                      : " · Suscrita"}
                  </span>
                </div>
                <div className="fila-seccion__acciones">
                  <Button variante="fantasma" onClick={() => setBorrando(s)}>
                    Eliminar<span className="visually-hidden"> a {s.email}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {consulta.hasNextPage && (
          <Button
            variante="secundario"
            cargando={consulta.isFetchingNextPage}
            onClick={() => consulta.fetchNextPage()}
          >
            Cargar más
          </Button>
        )}
      </section>
      <ConfirmDialog
        abierto={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo="¿Eliminar esta suscripción?"
        mensaje={`Se borrará por completo a ${borrando?.email}. Hazlo si te pidió que borres sus datos; si solo quiere dejar de recibir el boletín, basta con su baja. No se puede deshacer.`}
        textoConfirmar={`Eliminar a ${borrando?.email}`}
        onConfirmar={async () => {
          await borrar.mutateAsync(borrando!.id).catch(() => undefined);
        }}
      />
    </div>
  );
}
