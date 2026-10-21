import multer from "multer";
import { z } from "zod";
import { ApiError, notFound, parseOrThrow } from "../../http/errors.js";
import { cropImage, processImage } from "../../services/images.js";
import type { AdminDeps } from "./deps.js";
import { idParam, page, paginationSchema } from "./helpers.js";
import { ADMIN_ONLY, ANY_ROLE, type AdminRoute } from "./registry.js";

const entero = (campo: string, min: number) =>
  z.coerce.number(`Falta ${campo}.`).int().min(min, `${campo} no es válido.`);
const cropSchema = z.object({
  x: entero("La posición horizontal", 0),
  y: entero("La posición vertical", 0),
  width: entero("El ancho", 16),
  height: entero("El alto", 16),
});

export function mediaRoutes({ db, env, audit, storage, logger }: AdminDeps): AdminRoute[] {
  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(env.UPLOAD_MAX_MB * 1024 * 1024), files: 1, fields: 5 },
  }).single("archivo");

  return [
    {
      // Editores y administradores suben imágenes (portadas e imágenes del cuerpo).
      roles: ANY_ROLE,
      method: "post",
      path: "/media",
      handler: [
        subida,
        async (req, res) => {
          if (!req.file) {
            throw new ApiError(400, "VALIDATION", "Elige una imagen para subir.", {
              campos: { archivo: "Elige una imagen para subir." },
            });
          }
          const imagen = await processImage(req.file.buffer);
          const { url } = await storage.put(imagen.key, imagen.data, imagen.mimeType);
          const media = await db.media.create({
            data: {
              storageKey: imagen.key,
              url,
              mimeType: imagen.mimeType,
              sizeBytes: imagen.data.length,
              width: imagen.width,
              height: imagen.height,
              originalName: req.file.originalname.slice(0, 200),
              uploadedById: req.user!.id,
            },
          });
          await audit(req, { action: "MEDIA_UPLOAD", entity: "Media", entityId: media.id });
          res.status(201).json({ media });
        },
      ],
    },
    {
      // Recorta una imagen subida para que calce con su marco (foto cuadrada, portada
      // 16:9). Crea una imagen nueva: la original queda en la biblioteca, intacta.
      roles: ANY_ROLE,
      method: "post",
      path: "/media/:id/crop",
      handler: async (req, res) => {
        const id = idParam(req, "La imagen");
        const original = await db.media.findUnique({ where: { id } });
        if (!original) throw notFound("La imagen");
        const area = parseOrThrow(cropSchema, req.body);
        const imagen = await cropImage(
          await storage.get(original.storageKey),
          original.mimeType,
          area,
        );
        const { url } = await storage.put(imagen.key, imagen.data, imagen.mimeType);
        const media = await db.media.create({
          data: {
            storageKey: imagen.key,
            url,
            mimeType: imagen.mimeType,
            sizeBytes: imagen.data.length,
            width: imagen.width,
            height: imagen.height,
            originalName: `${original.originalName} (recorte)`.slice(0, 200),
            uploadedById: req.user!.id,
          },
        });
        await audit(req, {
          action: "MEDIA_CROP",
          entity: "Media",
          entityId: media.id,
          meta: { origen: original.id },
        });
        res.status(201).json({ media });
      },
    },
    {
      roles: ANY_ROLE,
      method: "get",
      path: "/media",
      handler: async (req, res) => {
        const q = parseOrThrow(paginationSchema, req.query);
        const filas = await db.media.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: q.limit + 1,
          ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
          include: { uploadedBy: { select: { name: true } } },
        });
        res.json(page(filas, q.limit));
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "delete",
      path: "/media/:id",
      handler: async (req, res) => {
        const id = idParam(req, "La imagen");
        const media = await db.media.findUnique({ where: { id } });
        if (!media) throw notFound("La imagen");

        const usos = await mediaUsages(db, media.id, media.url);
        if (usos.length) {
          throw new ApiError(
            409,
            "MEDIA_IN_USE",
            `No se puede borrar: la imagen se usa en ${usos.join(", ")}. Quítala de ahí primero.`,
            { usos },
          );
        }
        await db.media.delete({ where: { id } });
        try {
          await storage.remove(media.storageKey);
        } catch (err) {
          // El registro ya no existe; un archivo huérfano no afecta al sitio.
          logger.warn(
            { err, key: media.storageKey },
            "No se pudo borrar el archivo del almacenamiento",
          );
        }
        await audit(req, {
          action: "MEDIA_DELETE",
          entity: "Media",
          entityId: id,
          meta: { nombre: media.originalName },
        });
        res.status(204).end();
      },
    },
  ];
}

// Dónde se usa una imagen: como portada, foto, logo, o dentro de un texto enriquecido.
async function mediaUsages(db: AdminDeps["db"], id: string, url: string) {
  const [noticias, equipo, colaboradores, ajustes, enCuerpos, enSecciones] = await Promise.all([
    db.news.findMany({ where: { coverId: id }, select: { title: true } }),
    db.teamMember.findMany({ where: { photoId: id }, select: { name: true } }),
    db.collaborator.findMany({ where: { logoId: id }, select: { name: true } }),
    db.siteSettings.count({
      where: { OR: [{ logoLightId: id }, { logoDarkId: id }, { faviconId: id }] },
    }),
    db.news.findMany({ where: { bodyHtml: { contains: url } }, select: { title: true } }),
    db.$queryRaw<{ key: string }[]>`
      SELECT key FROM sections
      WHERE content::text LIKE ${"%" + url + "%"} OR "draftContent"::text LIKE ${"%" + url + "%"}`,
  ]);
  return [
    ...noticias.map((n) => `la portada de «${n.title}»`),
    ...enCuerpos.map((n) => `el cuerpo de «${n.title}»`),
    ...equipo.map((m) => `la foto de ${m.name}`),
    ...colaboradores.map((c) => `el logo de ${c.name}`),
    ...(ajustes ? ["la identidad visual"] : []),
    ...enSecciones.map((s) => `la sección «${s.key}»`),
  ];
}
