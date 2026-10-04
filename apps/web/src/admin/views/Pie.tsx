import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DEFAULT_FOOTER, footerSchema, type Footer } from "@server-footer";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button, IconButton } from "@shared/ui/Button";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Ajustes } from "../api";
import { AvisoCambiosSinGuardar, Cabecera, usePanelPage } from "../ui";
import { DatosContacto } from "./Contacto";

// Bases anteriores al pie editable guardan {}: se completa con el pie por defecto,
// igual que hace el servidor al publicarlo.
function desde(a: Ajustes): Footer {
  const r = footerSchema.safeParse(a.footer);
  return r.success ? r.data : DEFAULT_FOOTER;
}

// Los campos vacíos opcionales no se envían (el esquema los trata como ausentes).
function limpio(f: Footer): Footer {
  return {
    ...f,
    descripcion: f.descripcion?.trim() || undefined,
    textoLegal: f.textoLegal?.trim() || undefined,
  };
}

const id = (c: string) => `pie-${c.replaceAll(".", "-")}`;

function FormPie({ ajustes }: { ajustes: Ajustes }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inicial = useMemo(() => desde(ajustes), [ajustes]);
  const [form, setForm] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const sucio = JSON.stringify(form) !== base;

  const cambiarColumna = (i: number, cambio: Partial<Footer["columnas"][number]>) =>
    setForm({
      ...form,
      columnas: form.columnas.map((c, j) => (j === i ? { ...c, ...cambio } : c)),
    });

  async function guardar() {
    // Misma validación que el servidor, para marcar los errores sin esperar la respuesta.
    const datos = limpio(form);
    const r = footerSchema.safeParse(datos);
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setGuardando(true);
    try {
      const { settings } = await adminFetch<{ settings: Ajustes }>("/settings/footer", {
        method: "PUT",
        body: r.data,
      });
      const nuevo = desde(settings);
      setForm(nuevo);
      setBase(JSON.stringify(nuevo));
      setErrores({});
      queryClient.setQueryData(["admin", "ajustes"], { settings });
      toast.exito("Pie de página guardado. Ya se ve en el sitio.");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) setErrores(err.campos);
      else toast.error(`No se pudo guardar. ${mensajeDeError(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta-panel" aria-labelledby="pie-textos">
      <AvisoCambiosSinGuardar sucio={sucio} />
      <h2 id="pie-textos">Textos y enlaces</h2>
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
        <TextArea
          id={id("descripcion")}
          label="Descripción"
          opcional
          ayuda={`Una o dos frases bajo el nombre del sitio. ${(form.descripcion ?? "").length} de 300 caracteres.`}
          rows={3}
          maxLength={300}
          value={form.descripcion ?? ""}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          error={errores.descripcion}
        />

        <fieldset className="grupo-campos">
          <legend>Columnas de enlaces</legend>
          <p className="campo__ayuda">
            Hasta 3 columnas con hasta 6 enlaces cada una. Un enlace puede ir a una página del sitio
            (/nosotros), a una sección (#que-es) o a una dirección https://.
          </p>
          {errores.columnas && <p className="campo__error">{errores.columnas}</p>}
          {form.columnas.map((col, i) => (
            <fieldset key={i} className="grupo-campos grupo-campos--item">
              <legend>Columna {i + 1}</legend>
              <TextField
                id={id(`columnas.${i}.titulo`)}
                label="Título de la columna"
                maxLength={60}
                value={col.titulo}
                onChange={(e) => cambiarColumna(i, { titulo: e.target.value })}
                error={errores[`columnas.${i}.titulo`]}
              />
              {errores[`columnas.${i}.enlaces`] && (
                <p className="campo__error">{errores[`columnas.${i}.enlaces`]}</p>
              )}
              <ol className="lista-items">
                {col.enlaces.map((enlace, j) => {
                  const cambiar = (cambio: Partial<typeof enlace>) =>
                    cambiarColumna(i, {
                      enlaces: col.enlaces.map((x, k) => (k === j ? { ...x, ...cambio } : x)),
                    });
                  const mover = (d: number) => {
                    const copia = [...col.enlaces];
                    [copia[j], copia[j + d]] = [copia[j + d]!, copia[j]!];
                    cambiarColumna(i, { enlaces: copia });
                  };
                  return (
                    <li key={j} className="rejilla-panel rejilla-panel--enlace">
                      <TextField
                        id={id(`columnas.${i}.enlaces.${j}.texto`)}
                        label={`Texto del enlace ${j + 1}`}
                        maxLength={40}
                        value={enlace.texto}
                        onChange={(e) => cambiar({ texto: e.target.value })}
                        error={errores[`columnas.${i}.enlaces.${j}.texto`]}
                      />
                      <TextField
                        id={id(`columnas.${i}.enlaces.${j}.href`)}
                        label={`Destino del enlace ${j + 1}`}
                        value={enlace.href}
                        onChange={(e) => cambiar({ href: e.target.value })}
                        error={errores[`columnas.${i}.enlaces.${j}.href`]}
                      />
                      <div className="fila-botones">
                        <IconButton
                          label={`Subir enlace ${j + 1} de la columna ${i + 1}`}
                          aria-disabled={j === 0 || undefined}
                          onClick={() => j > 0 && mover(-1)}
                        >
                          <span aria-hidden="true">↑</span>
                        </IconButton>
                        <IconButton
                          label={`Bajar enlace ${j + 1} de la columna ${i + 1}`}
                          aria-disabled={j === col.enlaces.length - 1 || undefined}
                          onClick={() => j < col.enlaces.length - 1 && mover(1)}
                        >
                          <span aria-hidden="true">↓</span>
                        </IconButton>
                        {col.enlaces.length > 1 && (
                          <Button
                            variante="fantasma"
                            onClick={() =>
                              cambiarColumna(i, { enlaces: col.enlaces.filter((_, k) => k !== j) })
                            }
                          >
                            Quitar enlace {j + 1}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="fila-botones">
                {col.enlaces.length < 6 && (
                  <Button
                    variante="secundario"
                    onClick={() =>
                      cambiarColumna(i, { enlaces: [...col.enlaces, { texto: "", href: "/" }] })
                    }
                  >
                    Agregar enlace a la columna {i + 1}
                  </Button>
                )}
                <Button
                  variante="fantasma"
                  onClick={() =>
                    setForm({ ...form, columnas: form.columnas.filter((_, k) => k !== i) })
                  }
                >
                  Quitar columna {i + 1}
                </Button>
              </div>
            </fieldset>
          ))}
          {form.columnas.length < 3 && (
            <Button
              variante="secundario"
              onClick={() =>
                setForm({
                  ...form,
                  columnas: [...form.columnas, { titulo: "", enlaces: [{ texto: "", href: "/" }] }],
                })
              }
            >
              Agregar columna
            </Button>
          )}
        </fieldset>

        <fieldset className="grupo-campos">
          <legend>Bloques visibles</legend>
          <label className="casilla">
            <input
              type="checkbox"
              checked={form.mostrarContacto}
              onChange={(e) => setForm({ ...form, mostrarContacto: e.target.checked })}
            />
            Datos de contacto
          </label>
          <label className="casilla">
            <input
              type="checkbox"
              checked={form.mostrarRedes}
              onChange={(e) => setForm({ ...form, mostrarRedes: e.target.checked })}
            />
            Redes sociales
          </label>
          <label className="casilla">
            <input
              type="checkbox"
              checked={form.mostrarAccesibilidad}
              onChange={(e) => setForm({ ...form, mostrarAccesibilidad: e.target.checked })}
            />
            Declaración de accesibilidad
          </label>
        </fieldset>

        <TextField
          id={id("textoLegal")}
          label="Texto legal"
          opcional
          ayuda="Va después de «© año y nombre del sitio». Ejemplo: «Proyecto financiado por…»."
          maxLength={200}
          value={form.textoLegal ?? ""}
          onChange={(e) => setForm({ ...form, textoLegal: e.target.value })}
          error={errores.textoLegal}
        />

        <div className="fila-botones">
          <Button type="submit" cargando={guardando} textoCargando="Guardando…">
            {sucio ? "Guardar pie de página" : "Sin cambios por guardar"}
          </Button>
          <Button variante="fantasma" onClick={() => setForm(DEFAULT_FOOTER)}>
            Volver al pie por defecto
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function Pie() {
  const h1 = usePanelPage("Pie de página");
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "ajustes"],
    queryFn: () => adminFetch<{ settings: Ajustes }>("/settings"),
  });
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Pie de página"
        descripcion="Lo que aparece al final de todas las páginas del sitio: textos, enlaces, contacto y redes."
      />
      {isPending ? (
        <Cargando>
          <Skeleton alto="12rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : (
        <>
          <FormPie ajustes={data.settings} />
          <DatosContacto ajustes={data.settings} />
        </>
      )}
    </div>
  );
}
