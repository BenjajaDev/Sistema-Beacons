import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ConfirmDialog, Dialog } from "@shared/ui/Dialog";
import { SelectField, TextField } from "@shared/ui/Field";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type CuentaUsuario, type Rol } from "../api";
import { useAuth } from "../auth";
import { Cabecera, formatoFecha, Interruptor, usePanelPage, RegionDesplazable } from "../ui";

const ROLES: Record<Rol, string> = { ADMIN: "Administración", EDITOR: "Edición" };

function estadoCuenta(u: CuentaUsuario) {
  if (!u.active) return "Desactivada";
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date())
    return `Bloqueada hasta ${formatoFecha(u.lockedUntil)}`;
  if (u.mustChangePassword) return "Debe crear su contraseña";
  return "Activa";
}

// La contraseña temporal se muestra una sola vez.
function ClaveTemporal({
  datos,
  onCerrar,
}: {
  datos: { nombre: string; clave: string } | null;
  onCerrar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);
  return (
    <Dialog
      abierto={datos !== null}
      onCerrar={() => {
        setCopiada(false);
        onCerrar();
      }}
      titulo={`Contraseña temporal de ${datos?.nombre ?? ""}`}
      descripcion="Compártela por un canal seguro (no por correo abierto). No se volverá a mostrar. Al entrar, el panel le pedirá crear una propia."
      acciones={<Button onClick={onCerrar}>Listo</Button>}
    >
      <TextField
        label="Contraseña temporal"
        readOnly
        value={datos?.clave ?? ""}
        className="clave-temporal"
        spellCheck={false}
      />
      <Button
        variante="secundario"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(datos?.clave ?? "");
            setCopiada(true);
          } catch {
            setCopiada(false);
          }
        }}
      >
        {copiada ? "Copiada" : "Copiar contraseña"}
      </Button>
      <p className="visually-hidden" role="status">
        {copiada ? "Contraseña copiada al portapapeles." : ""}
      </p>
    </Dialog>
  );
}

export default function Usuarios() {
  const h1 = usePanelPage("Usuarios");
  const { usuario } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    email: string;
    role: Rol;
    active: boolean;
  } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [temporal, setTemporal] = useState<{ nombre: string; clave: string } | null>(null);
  const [restablecer, setRestablecer] = useState<CuentaUsuario | null>(null);
  const [desactivar, setDesactivar] = useState<CuentaUsuario | null>(null);
  const [eliminar, setEliminar] = useState<CuentaUsuario | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => adminFetch<{ items: CuentaUsuario[] }>("/users"),
  });
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    try {
      if (form.id) {
        await adminFetch(`/users/${form.id}`, {
          method: "PATCH",
          body: { name: form.name, role: form.role },
        });
        toast.exito("Cuenta actualizada.");
        setForm(null);
      } else {
        const r = await adminFetch<{ user: CuentaUsuario; temporaryPassword: string }>("/users", {
          method: "POST",
          body: { name: form.name, email: form.email, role: form.role },
        });
        setForm(null);
        setTemporal({ nombre: r.user.name, clave: r.temporaryPassword });
      }
      invalidar();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) setErrores(err.campos);
      else
        toast.error(
          err instanceof ApiError ? err.message : `No se pudo guardar. ${mensajeDeError(err)}`,
        );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActiva(u: CuentaUsuario, active: boolean) {
    try {
      await adminFetch(`/users/${u.id}`, { method: "PATCH", body: { active } });
      toast.exito(
        active
          ? `${u.name} puede volver a entrar.`
          : `${u.name} ya no puede entrar. Sus sesiones abiertas se cerraron.`,
      );
      invalidar();
    } catch (err) {
      toast.error(mensajeDeError(err));
    }
  }

  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Usuarios"
        descripcion="Cuentas con acceso al panel. No hay registro público: las cuentas se crean aquí."
        acciones={
          <Button
            onClick={() => {
              setErrores({});
              setForm({ name: "", email: "", role: "EDITOR", active: true });
            }}
          >
            Nueva cuenta
          </Button>
        }
      />
      {isPending ? (
        <Cargando etiqueta="Cargando cuentas…">
          <Skeleton alto="12rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : (
        <RegionDesplazable etiqueta="Cuentas del panel">
          <table className="tabla">
            <caption className="visually-hidden">Cuentas con acceso al panel</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Último acceso</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => {
                const yo = u.id === usuario?.id;
                return (
                  <tr key={u.id}>
                    <th scope="row">
                      {u.name} {yo && <span className="insignia">Tú</span>}
                      <span className="texto-suave bloque">{u.email}</span>
                    </th>
                    <td>{ROLES[u.role]}</td>
                    <td>{estadoCuenta(u)}</td>
                    <td>{formatoFecha(u.lastLoginAt)}</td>
                    <td>
                      <div className="fila-botones">
                        <Button
                          variante="secundario"
                          onClick={() => {
                            setErrores({});
                            setForm({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              role: u.role,
                              active: u.active,
                            });
                          }}
                        >
                          Editar<span className="visually-hidden"> a {u.name}</span>
                        </Button>
                        {!yo && (
                          <>
                            <Interruptor
                              activo={u.active}
                              etiqueta={`Activa: ${u.name}`}
                              onCambiar={(v) => (v ? cambiarActiva(u, true) : setDesactivar(u))}
                            />
                            <Button variante="fantasma" onClick={() => setRestablecer(u)}>
                              Restablecer contraseña
                              <span className="visually-hidden"> de {u.name}</span>
                            </Button>
                            <Button variante="peligro" onClick={() => setEliminar(u)}>
                              Eliminar
                              <span className="visually-hidden"> la cuenta de {u.name}</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </RegionDesplazable>
      )}

      <Dialog
        abierto={form !== null}
        onCerrar={() => setForm(null)}
        titulo={form?.id ? `Editar a ${form.name}` : "Nueva cuenta"}
        descripcion={
          form?.id ? undefined : "Se creará con una contraseña temporal que verás una sola vez."
        }
        acciones={
          <>
            <Button variante="secundario" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button cargando={guardando} textoCargando="Guardando…" onClick={guardar}>
              {form?.id ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </>
        }
      >
        {form && (
          <>
            <TextField
              label="Nombre"
              value={form.name}
              maxLength={120}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errores.name}
              data-autofocus
            />
            {!form.id && (
              <TextField
                label="Correo"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errores.email}
              />
            )}
            <SelectField
              label="Rol"
              value={form.role}
              disabled={form.id === usuario?.id}
              ayuda={
                form.id === usuario?.id
                  ? "No puedes cambiar tu propio rol."
                  : "Edición: escribe noticias y textos, sin publicar. Administración: todo el panel."
              }
              onChange={(e) => setForm({ ...form, role: e.target.value as Rol })}
            >
              <option value="EDITOR">Edición</option>
              <option value="ADMIN">Administración</option>
            </SelectField>
          </>
        )}
      </Dialog>

      <ClaveTemporal datos={temporal} onCerrar={() => setTemporal(null)} />

      <ConfirmDialog
        abierto={restablecer !== null}
        onCerrar={() => setRestablecer(null)}
        titulo={`¿Restablecer la contraseña de ${restablecer?.name}?`}
        mensaje="Su contraseña actual dejará de funcionar y se cerrarán sus sesiones. Te mostraremos una temporal para compartirle."
        textoConfirmar="Restablecer contraseña"
        peligro={false}
        onConfirmar={async () => {
          try {
            const r = await adminFetch<{ temporaryPassword: string }>(
              `/users/${restablecer!.id}/reset-password`,
              { method: "POST" },
            );
            setTemporal({ nombre: restablecer!.name, clave: r.temporaryPassword });
            invalidar();
          } catch (err) {
            toast.error(mensajeDeError(err));
          }
        }}
      />
      <ConfirmDialog
        abierto={desactivar !== null}
        onCerrar={() => setDesactivar(null)}
        titulo={`¿Desactivar la cuenta de ${desactivar?.name}?`}
        mensaje="No podrá entrar al panel y sus sesiones abiertas se cerrarán. Puedes volver a activarla cuando quieras."
        textoConfirmar="Desactivar cuenta"
        onConfirmar={() => cambiarActiva(desactivar!, false)}
      />
      <ConfirmDialog
        abierto={eliminar !== null}
        onCerrar={() => setEliminar(null)}
        titulo={`¿Eliminar la cuenta de ${eliminar?.name}?`}
        mensaje="La cuenta desaparece del panel y no se puede recuperar. Si tiene noticias, imágenes o beacons a su nombre, te pediremos desactivarla en su lugar."
        textoConfirmar="Eliminar cuenta"
        onConfirmar={async () => {
          try {
            await adminFetch(`/users/${eliminar!.id}`, { method: "DELETE" });
            toast.exito(`Cuenta de ${eliminar!.name} eliminada.`);
            invalidar();
          } catch (err) {
            toast.error(mensajeDeError(err));
          }
        }}
      />
    </div>
  );
}
