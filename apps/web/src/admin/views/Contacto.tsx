import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ConfirmDialog } from "@shared/ui/Dialog";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Ajustes, type Enlace, type Mensaje } from "../api";
import { AvisoCambiosSinGuardar, Cabecera, formatoFecha, usePanelPage } from "../ui";

interface FormContacto {
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  socials: Enlace[];
  accessibilityStatement: string;
}

const desde = (a: Ajustes): FormContacto => ({
  contactPhone: a.contactPhone ?? "",
  contactEmail: a.contactEmail ?? "",
  contactAddress: a.contactAddress ?? "",
  socials: a.socials,
  accessibilityStatement: a.accessibilityStatement,
});

export function DatosContacto({ ajustes }: { ajustes: Ajustes }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inicial = useMemo(() => desde(ajustes), [ajustes]);
  const [form, setForm] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const sucio = JSON.stringify(form) !== base;

  async function guardar() {
    setGuardando(true);
    try {
      const { settings } = await adminFetch<{ settings: Ajustes }>("/settings/contact", {
        method: "PUT",
        body: {
          ...form,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          contactAddress: form.contactAddress || null,
        },
      });
      const nuevo = desde(settings);
      setForm(nuevo);
      setBase(JSON.stringify(nuevo));
      setErrores({});
      queryClient.setQueryData(["admin", "ajustes"], { settings });
      toast.exito("Datos de contacto guardados.");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) setErrores(err.campos);
      else toast.error(`No se pudo guardar. ${mensajeDeError(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  const id = (c: string) => `contacto-${c.replaceAll(".", "-")}`;
  return (
    <section className="tarjeta-panel" aria-labelledby="datos-contacto">
      <AvisoCambiosSinGuardar sucio={sucio} />
      <h2 id="datos-contacto">Datos de contacto</h2>
      <p className="campo__ayuda">Se muestran en la página Contacto y en el pie del sitio.</p>
      <ErrorSummary
        errores={Object.entries(errores).map(([c, m]) => ({ campoId: id(c), mensaje: m }))}
      />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="rejilla-panel">
          <TextField
            id={id("contactPhone")}
            label="Teléfono"
            opcional
            type="tel"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            error={errores.contactPhone}
          />
          <TextField
            id={id("contactEmail")}
            label="Correo"
            opcional
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            error={errores.contactEmail}
          />
        </div>
        <TextField
          id={id("contactAddress")}
          label="Dirección"
          opcional
          value={form.contactAddress}
          maxLength={200}
          onChange={(e) => setForm({ ...form, contactAddress: e.target.value })}
          error={errores.contactAddress}
        />
        <fieldset className="grupo-campos">
          <legend>
            Redes sociales <span className="campo__opcional">(opcional)</span>
          </legend>
          {form.socials.map((r, i) => (
            <div key={i} className="grupo-campos grupo-campos--item">
              <TextField
                id={id(`socials.${i}.red`)}
                label={`Red ${i + 1}`}
                placeholder="Instagram"
                value={r.red}
                onChange={(e) =>
                  setForm({
                    ...form,
                    socials: form.socials.map((x, j) =>
                      j === i ? { ...x, red: e.target.value } : x,
                    ),
                  })
                }
                error={errores[`socials.${i}.red`]}
              />
              <TextField
                id={id(`socials.${i}.url`)}
                label={`Dirección de la red ${i + 1}`}
                placeholder="https://"
                value={r.url}
                onChange={(e) =>
                  setForm({
                    ...form,
                    socials: form.socials.map((x, j) =>
                      j === i ? { ...x, url: e.target.value } : x,
                    ),
                  })
                }
                error={errores[`socials.${i}.url`]}
              />
              <Button
                variante="fantasma"
                onClick={() =>
                  setForm({ ...form, socials: form.socials.filter((_, j) => j !== i) })
                }
              >
                Quitar red {i + 1}
              </Button>
            </div>
          ))}
          {form.socials.length < 10 && (
            <Button
              variante="secundario"
              onClick={() => setForm({ ...form, socials: [...form.socials, { red: "", url: "" }] })}
            >
              Agregar red social
            </Button>
          )}
        </fieldset>
        <TextArea
          id={id("accessibilityStatement")}
          label="Declaración de accesibilidad"
          ayuda="Aparece en el pie de todas las páginas. Indica el nivel que busca cumplir el sitio y cómo reportar barreras."
          rows={4}
          maxLength={2000}
          value={form.accessibilityStatement}
          onChange={(e) => setForm({ ...form, accessibilityStatement: e.target.value })}
          error={errores.accessibilityStatement}
        />
        <Button type="submit" cargando={guardando} textoCargando="Guardando…">
          {sucio ? "Guardar datos de contacto" : "Sin cambios por guardar"}
        </Button>
      </form>
    </section>
  );
}

function Mensajes() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [soloNoLeidos, setSoloNoLeidos] = useState(false);
  const [borrando, setBorrando] = useState<Mensaje | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["admin", "mensajes", { soloNoLeidos }],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      adminFetch<{ items: Mensaje[]; nextCursor: string | null; noLeidos: number }>(
        `/messages?limit=20${soloNoLeidos ? "&noLeidos=true" : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    getNextPageParam: (u) => u.nextCursor,
  });
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admin", "mensajes"] });
  const leido = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: boolean }) =>
      adminFetch(`/messages/${id}`, { method: "PATCH", body: { leido: valor } }),
    onSuccess: invalidar,
    onError: (err) => toast.error(`No se pudo actualizar el mensaje. ${mensajeDeError(err)}`),
  });

  const items = consulta.data?.pages.flatMap((p) => p.items) ?? [];
  const noLeidos = consulta.data?.pages[0]?.noLeidos ?? 0;

  return (
    <section className="tarjeta-panel" aria-labelledby="mensajes">
      <div className="vista-cabecera">
        <h2 id="mensajes">
          Mensajes recibidos {noLeidos > 0 && <span className="contador">{noLeidos} sin leer</span>}
        </h2>
        <label className="casilla">
          <input
            type="checkbox"
            checked={soloNoLeidos}
            onChange={(e) => setSoloNoLeidos(e.target.checked)}
          />
          Solo sin leer
        </label>
      </div>
      {consulta.isPending ? (
        <Cargando etiqueta="Cargando mensajes…">
          <Skeleton alto="10rem" />
        </Cargando>
      ) : consulta.error ? (
        <ErrorState
          mensaje={mensajeDeError(consulta.error)}
          onReintentar={() => consulta.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          titulo={soloNoLeidos ? "No hay mensajes sin leer" : "Aún no llegan mensajes"}
          texto="Los mensajes del formulario de contacto del sitio aparecerán aquí."
        />
      ) : (
        <ul className="mensajes">
          {items.map((m) => (
            <li key={m.id}>
              <article
                className={`mensaje ${m.readAt ? "" : "mensaje--nuevo"}`}
                aria-labelledby={`mensaje-${m.id}`}
              >
                <h3 id={`mensaje-${m.id}`}>
                  {!m.readAt && <span className="insignia">Nuevo</span>} {m.subject || "Sin asunto"}{" "}
                  · {m.name}
                </h3>
                <p className="texto-suave">
                  {formatoFecha(m.createdAt)} · <a href={`mailto:${m.email}`}>{m.email}</a>
                  {m.phone && (
                    <>
                      {" "}
                      · <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}>{m.phone}</a>
                    </>
                  )}
                </p>
                <p className="mensaje__texto">{m.message}</p>
                <div className="fila-botones">
                  <a
                    className="btn btn--secundario"
                    href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "Tu mensaje a SIGNAL"}`)}`}
                  >
                    Responder por correo<span className="visually-hidden"> a {m.name}</span>
                  </a>
                  <Button
                    variante="fantasma"
                    onClick={() => leido.mutate({ id: m.id, valor: !m.readAt })}
                  >
                    {m.readAt ? "Marcar como no leído" : "Marcar como leído"}
                  </Button>
                  <Button variante="fantasma" onClick={() => setBorrando(m)}>
                    Borrar<span className="visually-hidden"> el mensaje de {m.name}</span>
                  </Button>
                </div>
              </article>
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
          Cargar más mensajes
        </Button>
      )}
      <ConfirmDialog
        abierto={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo="¿Borrar este mensaje?"
        mensaje={`Se eliminará el mensaje de ${borrando?.name}. No se puede deshacer.`}
        textoConfirmar="Borrar mensaje"
        onConfirmar={async () => {
          try {
            await adminFetch(`/messages/${borrando!.id}`, { method: "DELETE" });
            toast.exito("Mensaje borrado.");
            invalidar();
          } catch (err) {
            toast.error(`No se pudo borrar. ${mensajeDeError(err)}`);
          }
        }}
      />
    </section>
  );
}

// Los datos de contacto se editan en «Pie de página» (DatosContacto se usa allí).
export default function Contacto() {
  const h1 = usePanelPage("Mensajes");
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Mensajes"
        descripcion="Lo que llega por el formulario de la página Contacto. Teléfono, correo y redes se editan en «Pie de página»."
      />
      <Mensajes />
    </div>
  );
}
