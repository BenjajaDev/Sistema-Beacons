import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { SelectField } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { adminFetch, type EntradaBitacora } from "../api";
import { Cabecera, formatoFecha, usePanelPage, RegionDesplazable } from "../ui";

// Nombres legibles de las acciones que registra el servidor.
const ACCIONES: Record<string, string> = {
  LOGIN_OK: "Inició sesión",
  LOGIN_FAIL: "Intento de inicio de sesión fallido",
  LOGIN_BLOCKED: "Intento con la cuenta bloqueada",
  ACCOUNT_LOCKED: "Cuenta bloqueada por intentos fallidos",
  LOGOUT: "Cerró sesión",
  PASSWORD_CHANGE: "Cambió su contraseña",
  USER_CREATE: "Creó una cuenta",
  USER_UPDATE: "Editó una cuenta",
  USER_DEACTIVATE: "Desactivó una cuenta",
  USER_PASSWORD_RESET: "Restableció una contraseña",
  USER_DELETE: "Eliminó una cuenta",
  PROFILE_UPDATE: "Editó su perfil",
  NEWS_CREATE: "Creó una noticia",
  NEWS_UPDATE: "Editó una noticia",
  NEWS_SUBMIT: "Envió una noticia a revisión",
  NEWS_PUBLISH: "Publicó una noticia",
  NEWS_REJECT: "Devolvió una noticia",
  NEWS_UNPUBLISH: "Despublicó una noticia",
  NEWS_DELETE: "Borró una noticia",
  SECTION_DRAFT_SAVE: "Guardó el borrador de una sección",
  SECTION_DRAFT_DISCARD: "Descartó el borrador de una sección",
  SECTION_SUBMIT: "Envió una sección a revisión",
  SECTION_PUBLISH: "Publicó una sección",
  SECTION_REJECT: "Devolvió una sección",
  SECTION_SHOW: "Mostró una sección",
  SECTION_HIDE: "Ocultó una sección",
  SECTION_REORDER: "Reordenó secciones",
  SETTINGS_IDENTITY_UPDATE: "Cambió la identidad visual",
  SETTINGS_CONTACT_UPDATE: "Cambió los datos de contacto",
  SETTINGS_FOOTER_UPDATE: "Cambió el pie de página",
  MEDIA_UPLOAD: "Subió una imagen",
  MEDIA_DELETE: "Borró una imagen",
  BEACON_CREATE: "Registró un beacon",
  BEACON_UPDATE: "Editó un beacon",
  BEACON_DELETE: "Borró un beacon",
  BEACONS_IMPORT: "Importó beacons",
  TEAM_MEMBER_CREATE: "Agregó una persona al equipo",
  TEAM_MEMBER_UPDATE: "Editó a una persona del equipo",
  TEAM_MEMBER_DELETE: "Quitó a una persona del equipo",
  TEAM_MEMBER_REORDER: "Reordenó el equipo",
  COLLABORATOR_CREATE: "Agregó un colaborador",
  COLLABORATOR_UPDATE: "Editó un colaborador",
  COLLABORATOR_DELETE: "Quitó un colaborador",
  COLLABORATOR_REORDER: "Reordenó los colaboradores",
  MESSAGE_DELETE: "Borró un mensaje",
};

// Mismas áreas que el servidor (AUDIT_AREAS en server/src/routes/admin/audit-log.ts).
const AREAS = [
  { valor: "", texto: "Todo" },
  { valor: "sesiones", texto: "Sesiones" },
  { valor: "contenido", texto: "Contenido" },
  { valor: "cms", texto: "CMS" },
  { valor: "usuarios", texto: "Usuarios" },
] as const;

function detalle(e: EntradaBitacora) {
  const meta = (e.meta ?? {}) as Record<string, unknown>;
  const partes: string[] = [];
  for (const clave of ["clave", "titulo", "title", "nombre", "email", "note", "origen"]) {
    if (typeof meta[clave] === "string") partes.push(String(meta[clave]));
  }
  if (Array.isArray(meta.campos) && meta.campos.length)
    partes.push(`campos: ${meta.campos.join(", ")}`);
  if (e.entity === "Section" && e.entityId) partes.push(e.entityId);
  return partes.join(" · ") || "—";
}

export default function Bitacora() {
  const h1 = usePanelPage("Bitácora");
  const [accion, setAccion] = useState("");
  const [area, setArea] = useState("");
  const consulta = useInfiniteQuery({
    queryKey: ["admin", "bitacora", accion, area],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      adminFetch<{ items: EntradaBitacora[]; nextCursor: string | null }>(
        `/audit?limit=50${accion ? `&action=${accion}` : ""}${area ? `&area=${area}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    getNextPageParam: (u) => u.nextCursor,
  });
  const items = consulta.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="vista-contenido">
      <Cabecera refH1={h1} titulo="Bitácora" descripcion="Quién hizo qué y cuándo en el panel." />
      <fieldset className="segmentado segmentado--texto">
        <legend>Área del panel</legend>
        {AREAS.map((a) => (
          <label key={a.valor}>
            <input
              type="radio"
              name="area-bitacora"
              value={a.valor}
              checked={area === a.valor}
              onChange={() => setArea(a.valor)}
            />
            {a.texto}
          </label>
        ))}
      </fieldset>
      <SelectField
        label="Filtrar por acción"
        opcional
        value={accion}
        onChange={(e) => setAccion(e.target.value)}
      >
        <option value="">Todas las acciones</option>
        {Object.entries(ACCIONES).map(([codigo, texto]) => (
          <option key={codigo} value={codigo}>
            {texto}
          </option>
        ))}
      </SelectField>
      {consulta.isPending ? (
        <Cargando etiqueta="Cargando la bitácora…">
          <Skeleton alto="16rem" />
        </Cargando>
      ) : consulta.error ? (
        <ErrorState
          mensaje={mensajeDeError(consulta.error)}
          onReintentar={() => consulta.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          titulo="No hay registros"
          texto={accion || area ? "Prueba con otra acción o área." : undefined}
        />
      ) : (
        <>
          <RegionDesplazable etiqueta="Registros de la bitácora">
            <table className="tabla">
              <caption className="visually-hidden">
                Registros de la bitácora, del más reciente al más antiguo
              </caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Persona</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td>{formatoFecha(e.createdAt)}</td>
                    <td>{e.user?.name ?? "Sistema"}</td>
                    <td>{ACCIONES[e.action] ?? e.action}</td>
                    <td>{detalle(e)}</td>
                    <td>{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RegionDesplazable>
          {consulta.hasNextPage && (
            <Button
              variante="secundario"
              cargando={consulta.isFetchingNextPage}
              onClick={() => consulta.fetchNextPage()}
            >
              Cargar registros anteriores
            </Button>
          )}
        </>
      )}
    </div>
  );
}
