import { z } from "zod";
import { notFound, parseOrThrow } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { idParam, page, paginationSchema } from "./helpers.js";
import { COMUNICACION, type AdminRoute } from "./registry.js";

// Suscriptores del boletín. Aquí no se envía nada: el equipo descarga la lista de
// quienes siguen suscritos (con su enlace de baja) y la usa en su herramienta de
// correo. Por eso la exportación solo incluye a las personas activas.

const listSchema = paginationSchema.extend({
  estado: z.enum(["activos", "bajas", "todos"]).default("activos"),
});

// Marca de orden de bytes (U+FEFF): hace que Excel lea bien las tildes del CSV.
const BOM = String.fromCharCode(0xfeff);

// Un valor que empieza con = + - @ lo interpreta Excel como fórmula: se neutraliza.
function celdaCsv(valor: string) {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replaceAll('"', '""')}"`;
}

export function subscriberRoutes({ db, env, audit }: AdminDeps): AdminRoute[] {
  return [
    {
      roles: COMUNICACION,
      method: "get",
      path: "/subscribers",
      handler: async (req, res) => {
        const q = parseOrThrow(listSchema, req.query);
        const where =
          q.estado === "activos"
            ? { unsubscribedAt: null }
            : q.estado === "bajas"
              ? { unsubscribedAt: { not: null } }
              : {};
        const [filas, activos, bajas] = await Promise.all([
          db.subscriber.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: q.limit + 1,
            ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
            select: {
              id: true,
              email: true,
              name: true,
              consentAt: true,
              unsubscribedAt: true,
              createdAt: true,
            },
          }),
          db.subscriber.count({ where: { unsubscribedAt: null } }),
          db.subscriber.count({ where: { unsubscribedAt: { not: null } } }),
        ]);
        res.json({ ...page(filas, q.limit), resumen: { activos, bajas } });
      },
    },
    {
      roles: COMUNICACION,
      method: "get",
      path: "/subscribers/export",
      handler: async (req, res) => {
        const filas = await db.subscriber.findMany({
          where: { unsubscribedAt: null },
          orderBy: { createdAt: "asc" },
          select: { email: true, name: true, consentAt: true, token: true },
        });
        const origen = (env.SITE_URL ?? `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const lineas = [
          ["correo", "nombre", "consentimiento", "enlace_de_baja"].map(celdaCsv).join(","),
          ...filas.map((f) =>
            [
              f.email,
              f.name ?? "",
              f.consentAt.toISOString(),
              `${origen}/boletin/baja?t=${f.token}`,
            ]
              .map(celdaCsv)
              .join(","),
          ),
        ];
        // El registro no guarda correos: solo cuántos se descargaron y quién lo hizo.
        await audit(req, { action: "SUBSCRIBERS_EXPORT", meta: { cantidad: filas.length } });
        res
          .status(200)
          .type("text/csv; charset=utf-8")
          .setHeader("Content-Disposition", 'attachment; filename="suscriptores-boletin.csv"')
          .send(`${BOM}${lineas.join("\r\n")}\r\n`);
      },
    },
    {
      // Eliminar a la persona por completo (derecho de supresión), no solo darla de baja.
      roles: COMUNICACION,
      method: "delete",
      path: "/subscribers/:id",
      handler: async (req, res) => {
        const id = idParam(req, "La suscripción");
        const existe = await db.subscriber.findUnique({ where: { id }, select: { id: true } });
        if (!existe) throw notFound("La suscripción");
        await db.subscriber.delete({ where: { id } });
        await audit(req, { action: "SUBSCRIBER_DELETE", entity: "Subscriber", entityId: id });
        res.status(204).end();
      },
    },
  ];
}
