import { z } from "zod";
import { footerSchema, parseFooter } from "../../content/footer.js";
import { checkPaletteContrast, fontsSchema, paletteSchema } from "../../content/theme.js";
import { ApiError, parseOrThrow } from "../../http/errors.js";
import { asJson } from "../../lib/json.js";
import type { AdminDeps } from "./deps.js";
import { assertImage, changedFields, textoOpcional, urlHttps } from "./helpers.js";
import { ADMIN_ONLY, type AdminRoute } from "./registry.js";

const imagenId = z
  .uuid("Imagen no válida.")
  .nullish()
  .transform((v) => v ?? null);

const identitySchema = z.object({
  siteName: z
    .string("Escribe el nombre del sitio.")
    .trim()
    .min(1, "Escribe el nombre del sitio.")
    .max(60),
  tagline: textoOpcional(120),
  palette: paletteSchema,
  fonts: fontsSchema,
  logoLightId: imagenId,
  logoLightAlt: textoOpcional(200),
  logoDarkId: imagenId,
  logoDarkAlt: textoOpcional(200),
  faviconId: imagenId,
});

const contactSchema = z.object({
  contactPhone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{6,25}$/, "Escribe un teléfono válido, por ejemplo +56 9 1234 5678.")
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  contactEmail: z
    .email("Escribe un correo válido.")
    .nullish()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  contactAddress: textoOpcional(200),
  socials: z
    .array(
      z.object({
        red: z.string().trim().min(1, "Indica la red social.").max(40),
        url: urlHttps,
        etiqueta: z.string().trim().max(80).optional(),
      }),
    )
    .max(10),
  accessibilityStatement: z
    .string("Escribe la declaración de accesibilidad.")
    .trim()
    .min(1, "Escribe la declaración de accesibilidad.")
    .max(2000),
});

const IMAGEN = { select: { id: true, url: true, width: true, height: true } } as const;

export function settingsRoutes({ db, audit }: AdminDeps): AdminRoute[] {
  async function actual() {
    const ajustes = await db.siteSettings.findUnique({
      where: { id: 1 },
      include: { logoLight: IMAGEN, logoDark: IMAGEN, favicon: IMAGEN },
    });
    if (!ajustes) {
      throw new ApiError(
        503,
        "NOT_SEEDED",
        "Falta la configuración inicial del sitio. Ejecuta `npm run seed` en el servidor.",
      );
    }
    return ajustes;
  }

  return [
    {
      roles: ADMIN_ONLY,
      method: "get",
      path: "/settings",
      handler: async (_req, res) => {
        res.json({ settings: await actual() });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "put",
      path: "/settings/identity",
      handler: async (req, res) => {
        const antes = await actual();
        const d = parseOrThrow(identitySchema, req.body);

        const fallas = checkPaletteContrast(d.palette);
        if (fallas.length) {
          throw new ApiError(
            400,
            "CONTRAST",
            "Algunos colores no tienen contraste suficiente para leerse bien. Ajusta los marcados.",
            {
              fallas: fallas.map((f) => ({
                modo: f.modo,
                frente: f.frente,
                fondo: f.fondo,
                uso: f.uso,
                ratio: Math.round(f.ratio * 100) / 100,
                minimo: f.minimo,
              })),
            },
          );
        }
        await assertImage(
          db,
          { id: d.logoLightId, alt: d.logoLightAlt },
          { id: "logoLightId", alt: "logoLightAlt" },
        );
        await assertImage(
          db,
          { id: d.logoDarkId, alt: d.logoDarkAlt },
          { id: "logoDarkId", alt: "logoDarkAlt" },
        );
        // El favicon es decorativo (el nombre del sitio ya está en el <title>): no lleva alt.
        await assertImage(
          db,
          { id: d.faviconId, alt: "favicon" },
          { id: "faviconId", alt: "faviconId" },
        );

        await db.siteSettings.update({
          where: { id: 1 },
          data: {
            ...d,
            logoLightAlt: d.logoLightId ? d.logoLightAlt : null,
            logoDarkAlt: d.logoDarkId ? d.logoDarkAlt : null,
            palette: asJson(d.palette),
            fonts: asJson(d.fonts),
            updatedById: req.user!.id,
          },
        });
        await audit(req, {
          action: "SETTINGS_IDENTITY_UPDATE",
          entity: "SiteSettings",
          meta: { campos: changedFields(antes, d) },
        });
        res.json({ settings: await actual() });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "put",
      path: "/settings/contact",
      handler: async (req, res) => {
        const antes = await actual();
        const d = parseOrThrow(contactSchema, req.body);
        await db.siteSettings.update({
          where: { id: 1 },
          data: { ...d, socials: asJson(d.socials), updatedById: req.user!.id },
        });
        await audit(req, {
          action: "SETTINGS_CONTACT_UPDATE",
          entity: "SiteSettings",
          meta: { campos: changedFields(antes, d) },
        });
        res.json({ settings: await actual() });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "put",
      path: "/settings/footer",
      handler: async (req, res) => {
        const antes = parseFooter((await actual()).footer);
        const d = parseOrThrow(footerSchema, req.body);
        await db.siteSettings.update({
          where: { id: 1 },
          data: { footer: asJson(d), updatedById: req.user!.id },
        });
        await audit(req, {
          action: "SETTINGS_FOOTER_UPDATE",
          entity: "SiteSettings",
          meta: { campos: changedFields(antes, d) },
        });
        res.json({ settings: await actual() });
      },
    },
  ];
}
