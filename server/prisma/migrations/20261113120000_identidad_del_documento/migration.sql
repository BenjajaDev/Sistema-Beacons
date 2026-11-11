-- Identidad de la propuesta: Azul Claro #79ACF0 (antes #9DC2F7) y Red Hat Display como
-- tipografía. Solo se actualiza lo que sigue siendo el valor por defecto anterior:
-- un color o una fuente que el equipo ya eligió a mano no se toca.

UPDATE "site_settings"
SET "palette" = replace("palette"::text, '"#9DC2F7"', '"#79ACF0"')::jsonb
WHERE "palette"::text LIKE '%"#9DC2F7"%';

UPDATE "site_settings"
SET "fonts" = '{"cuerpo": "red-hat-display", "titulos": "red-hat-display"}'::jsonb
WHERE "fonts" = '{"cuerpo": "atkinson-hyperlegible-next", "titulos": "bricolage-grotesque"}'::jsonb;
