import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@shared/api";
import { adminFetch, escucharSesion, setCsrfToken, type Rol, type Usuario } from "./api";

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  // Motivo por el que se volvió al login (sesión expirada), para explicarlo.
  aviso: string | null;
  iniciarSesion: (email: string, password: string) => Promise<Usuario>;
  cerrarSesion: () => Promise<void>;
  cambiarContrasena: (actual: string, nueva: string) => Promise<void>;
  // Guarda los datos del perfil propio (nombre) y actualiza la sesión.
  actualizarPerfil: (datos: { name: string }) => Promise<void>;
  tiene: (...roles: Rol[]) => boolean;
}

const Contexto = createContext<Sesion | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  // Al abrir el panel: ¿hay sesión? Si la hay, se pide un token CSRF para ella.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const { user } = await adminFetch<{ user: Usuario }>("/auth/me");
        const { csrfToken } = await adminFetch<{ csrfToken: string }>("/auth/csrf");
        if (!vigente) return;
        setCsrfToken(csrfToken);
        setUsuario(user);
      } catch {
        // Sin sesión: se muestra el login.
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    escucharSesion({
      sesionExpirada: () => {
        setUsuario(null);
        setCsrfToken(null);
        queryClient.clear();
        setAviso(
          "Tu sesión expiró o se cerró desde otro lugar. Vuelve a iniciar sesión para continuar.",
        );
      },
      cambioRequerido: () => setUsuario((u) => (u ? { ...u, mustChangePassword: true } : u)),
    });
  }, [queryClient]);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const { user, csrfToken } = await adminFetch<{ user: Usuario; csrfToken: string }>(
      "/auth/login",
      { method: "POST", body: { email, password } },
    );
    setCsrfToken(csrfToken);
    setAviso(null);
    setUsuario(user);
    return user;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await adminFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      // Si la sesión ya no existía, el resultado es el mismo.
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
    }
    setCsrfToken(null);
    setUsuario(null);
    queryClient.clear();
  }, [queryClient]);

  const cambiarContrasena = useCallback(async (actual: string, nueva: string) => {
    const { user, csrfToken } = await adminFetch<{ user: Usuario; csrfToken: string }>(
      "/auth/change-password",
      { method: "POST", body: { currentPassword: actual, newPassword: nueva } },
    );
    setCsrfToken(csrfToken);
    setUsuario(user);
  }, []);

  const actualizarPerfil = useCallback(async (datos: { name: string }) => {
    const { user } = await adminFetch<{ user: Usuario }>("/auth/me", {
      method: "PATCH",
      body: datos,
    });
    setUsuario(user);
  }, []);

  const valor = useMemo<Sesion>(
    () => ({
      usuario,
      cargando,
      aviso,
      iniciarSesion,
      cerrarSesion,
      cambiarContrasena,
      actualizarPerfil,
      tiene: (...roles) => Boolean(usuario && roles.includes(usuario.role)),
    }),
    [usuario, cargando, aviso, iniciarSesion, cerrarSesion, cambiarContrasena, actualizarPerfil],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return s;
}
