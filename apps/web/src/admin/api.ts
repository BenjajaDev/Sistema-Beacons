import { apiFetch, ApiError, type ApiFetchOptions } from "@shared/api";

// Cliente de /api/admin. Agrega el token CSRF en las peticiones que modifican,
// lo renueva una vez si caducó, y avisa a la app cuando la sesión expiró o
// cuando hay que cambiar la contraseña.

export type Rol = "ADMIN" | "EDITOR";

export interface Usuario {
  id: string;
  email: string;
  name: string;
  role: Rol;
  mustChangePassword: boolean;
}

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

type Aviso = () => void;
const avisos: { sesionExpirada: Aviso; cambioRequerido: Aviso } = {
  sesionExpirada: () => {},
  cambioRequerido: () => {},
};
export function escucharSesion(handlers: Partial<typeof avisos>) {
  Object.assign(avisos, handlers);
}

async function renovarCsrf() {
  const { csrfToken: nuevo } = await apiFetch<{ csrfToken: string }>("/api/admin/auth/csrf");
  csrfToken = nuevo;
}

export async function adminFetch<T>(ruta: string, opciones: ApiFetchOptions = {}): Promise<T> {
  const metodo = opciones.method ?? "GET";
  const pedir = () =>
    apiFetch<T>(`/api/admin${ruta}`, {
      ...opciones,
      headers: {
        ...opciones.headers,
        ...(metodo !== "GET" && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    });

  try {
    return await pedir();
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.code === "CSRF_INVALID") {
      // El token caducó (por ejemplo, tras renovar la sesión en otra pestaña).
      await renovarCsrf();
      return pedir();
    }
    if (err.status === 401 && ruta !== "/auth/login") avisos.sesionExpirada();
    if (err.code === "PASSWORD_CHANGE_REQUIRED") avisos.cambioRequerido();
    throw err;
  }
}

// --- Tipos de la API del panel ------------------------------------------------

export interface MediaItem {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  originalName: string;
  createdAt: string;
  uploadedBy?: { name: string } | null;
}

export interface Pagina<T> {
  items: T[];
  nextCursor: string | null;
}

export interface A11yIssue {
  code: string;
  message: string;
}
export interface InformeAccesibilidad {
  errores: A11yIssue[];
  advertencias: A11yIssue[];
}

export type EstadoNoticia = "DRAFT" | "REVIEW" | "PUBLISHED";

export interface Noticia {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  bodyJson: unknown;
  coverId: string | null;
  coverAlt: string | null;
  cover: { id: string; url: string; width: number | null; height: number | null } | null;
  status: EstadoNoticia;
  reviewNote: string | null;
  author: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
  publishedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  accesibilidad: InformeAccesibilidad | null;
  lectura: { palabras: number; minutosLectura: number } | null;
}

export interface Seccion {
  id: string;
  key: string;
  nombre: string;
  page: "INICIO" | "NOSOTROS" | "NOTICIAS" | "CONTACTO";
  order: number;
  visible: boolean;
  content: Record<string, unknown>;
  draftContent: Record<string, unknown> | null;
  draftStatus: "DRAFT" | "REVIEW" | null;
  draftAuthor: { id: string; name: string } | null;
  draftUpdatedAt: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
}

export interface Imagen {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface Enlace {
  red: string;
  url: string;
  etiqueta?: string;
}

export interface Persona {
  id: string;
  name: string;
  position: string;
  bio: string | null;
  photoId: string | null;
  photoAlt: string | null;
  photo: Imagen | null;
  links: Enlace[];
  order: number;
  visible: boolean;
}

export interface Colaborador {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  logoId: string | null;
  logoAlt: string | null;
  logo: Imagen | null;
  order: number;
  visible: boolean;
}

export interface Ajustes {
  siteName: string;
  tagline: string | null;
  palette: import("@server-theme").Palette;
  fonts: import("@server-theme").Fonts;
  logoLightId: string | null;
  logoLightAlt: string | null;
  logoLight: Imagen | null;
  logoDarkId: string | null;
  logoDarkAlt: string | null;
  logoDark: Imagen | null;
  faviconId: string | null;
  favicon: Imagen | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  socials: Enlace[];
  accessibilityStatement: string;
  // Lo guardado puede venir vacío ({}) en bases anteriores al pie editable.
  footer: Partial<import("@server-footer").Footer>;
}

export interface Beacon {
  id: string;
  major: number;
  minor: number;
  clave: string;
  titulo: string;
  descripcion: string;
  ubicacion: string | null;
  completo: boolean;
  updatedAt: string;
  updatedBy: { name: string } | null;
}

export interface CuentaUsuario {
  id: string;
  email: string;
  name: string;
  role: Rol;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
}

export interface Mensaje {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface EntradaBitacora {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}
