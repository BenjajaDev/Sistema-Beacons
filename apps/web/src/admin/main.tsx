import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "@shared/styles/index.css";
import "./admin.css";
import { AuthProvider } from "./auth";
import { PANEL_MARKER } from "./marker";
import { crearRouter } from "./routes";

document.documentElement.dataset.app = PANEL_MARKER;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Los 401/403/404 no se reintentan: el mensaje ya dice qué hacer.
      retry: (intentos, error) =>
        intentos < 1 &&
        !(
          error &&
          "status" in error &&
          [401, 403, 404].includes((error as { status: number }).status)
        ),
    },
  },
});
const router = crearRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
