# Propuesta web de SIGNAL: del documento al sitio

Este documento traduce la **«Propuesta de desarrollo y arquitectura digital: plataforma web institucional»** del proyecto a decisiones concretas sobre el sitio que ya existe. Cada paso de la implementación queda registrado en la [bitácora](bitacora.md).

> El documento original (`Propuesta_Web_Proyecto_SIGNAL_Detallada.docx`) lo aportó el equipo y no se versiona aquí. Esta página resume lo que pide y cómo se resolvió.

## 1. Lo que pide el documento

Que el sitio no sea solo una presentación, sino un **nodo de transferencia de conocimiento**: identidad y misión, métricas de impacto, equipo y alianzas, repositorio de recursos abiertos, sala de prensa, galería, contacto segmentado y un módulo de accesibilidad universal, con la paleta y las tipografías de la propuesta.

## 2. Qué ya coincidía antes de empezar

| Del documento                                                                 | En el sitio                                                       |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Paleta `#004AAD`, `#3D1534`, `#F6E0B6`, `#FFF4EB`                             | Es la paleta de la app Android y de toda la web                   |
| Contraste del cobalto sobre crema (7,51:1) y del violeta sobre crema (14,3:1) | Verificado: el documento acierta                                  |
| Hero con dos botones, objetivos en tarjetas, últimas novedades                | Existen como secciones editables                                  |
| Textos alternativos, jerarquía de encabezados, teclado, foco visible          | Exigidos por el panel y verificados con axe en cada cambio        |
| Tamaño de letra, tema claro y oscuro                                          | Existen (5 tamaños de 87,5 % a 150 %)                             |
| Umbrales de Lighthouse (accesibilidad > 95)                                   | Se exigen en el CI (accesibilidad ≥ 95, rendimiento ≥ 90)         |
| Panel autoadministrable                                                       | Es el panel propio: no hace falta WordPress ni un CMS externo     |

## 3. Decisiones de diseño

| Tema                          | Decisión                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plataforma                    | **Se mantiene la actual.** Cumple lo que el documento busca de WordPress o de un sitio estático con CMS (publicar sin desarrolladores, velocidad, seguridad) y ya está desplegada.                                                                                  |
| Barra de accesibilidad        | **Un botón «Accesibilidad» en el encabezado que abre un panel**, en vez de una barra lateral fija. Una barra fija tapa contenido con zoom al 200 % y en móvil.                                                                                                       |
| Hero con video                | **Se descarta.** Perjudica el rendimiento y exige pausa. El hero conserva la ilustración de la señal.                                                                                                                                                                |
| Contadores «En cifras»        | **Se muestran directo** con el valor final si la persona pidió menos movimiento; si no, cuentan una sola vez al aparecer.                                                                                                                                           |
| Noticias en carrusel          | **Se descarta.** Un carrusel que avanza solo es un riesgo de accesibilidad; se mantienen las 3 tarjetas fijas.                                                                                                                                                       |
| Alto contraste                | Es un **tercer tema**, distinto del modo oscuro: amarillo sobre negro (19,6:1). No es editable desde Identidad visual porque su razón de ser es no variar.                                                                                                           |
| Fuente para dislexia          | **OpenDyslexic**, autoalojada (licencia libre). Se ofrece como opción: la evidencia de que ayude es limitada, así que no es la fuente por defecto.                                                                                                                  |
| Contenido numérico            | **No se inventa.** Las cifras de «En cifras», los hitos y los recursos los aporta el equipo desde el panel.                                                                                                                                                          |
| Compartir en redes            | Enlaces simples a WhatsApp, LinkedIn y X, **sin scripts de terceros** (la política de seguridad del sitio no los permite y cuidan la privacidad).                                                                                                                  |
| Mapa                          | **Dirección con enlace «Cómo llegar»**, no un mapa embebido: un iframe de mapa es difícil de usar con teclado y lector de pantalla.                                                                                                                                  |
| WhatsApp                      | Botón destacado en la página de Contacto, **no flotante** (un botón fijo choca con el zoom y con el panel de accesibilidad).                                                                                                                                         |

## 4. Decisiones abiertas

Las debe tomar el equipo. Mientras tanto se mantiene lo ya existente.

| Decisión                        | Opciones                                                                                              | Estado y recomendación                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipografías                     | Atkinson Hyperlegible (actual) frente a Glacial Indifference, Garet y Red Hat Display del documento   | **Abierta.** Se conserva Atkinson. Glacial y Garet no se pueden instalar como paquete y su licencia debe revisarse. Red Hat Display sí, para títulos. |
| Azul Claro                      | `#9DC2F7` (app) o `#79ACF0` (documento)                                                               | **Abierta.** Se conserva `#9DC2F7`. `#79ACF0` da 2,3:1 sobre blanco: solo decorativo. Si se cambia, se cambia también en la app.              |
| Recursos: ¿subir PDF o enlazar? | Subir al sitio o enlazar a un repositorio institucional (DOI)                                         | **Abierta**, de la etapa 2.                                                                                                                  |
| Boletín                         | Guardar suscriptores en la base propia o conectar un servicio externo                                 | **Abierta**, de la etapa 2. Exige consentimiento y baja (ley chilena de datos personales).                                                   |

## 5. Etapas

### Etapa 1: todo editable desde el panel (este trabajo)

| Pieza del documento                              | Qué se hace                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Módulo de accesibilidad                          | Panel con tamaño de letra, tema, **alto contraste**, **fuente para dislexia** y **guía de lectura** |
| «En cifras»                                      | Sección nueva `cifras`                                                                          |
| Línea de tiempo de proyecciones                  | Sección nueva `hitos` con estado (hecho, en curso, futuro)                                      |
| Objetivos con ícono                              | Ícono elegible por tarjeta                                                                      |
| Comité consultivo y estudiantes en práctica      | Grupo en cada persona del equipo                                                                |
| Filiación académica y perfiles                   | Campo de filiación; íconos de ORCID y ResearchGate                                              |
| Red de alianzas por tipo                         | Tipo en cada colaborador; logos en gris que se colorean al apuntar o enfocar                    |
| Sala de prensa                                   | Cinco categorías fijas, firma de autor y botones de compartir                                   |
| Contacto segmentado                              | Motivo de consulta, botón de WhatsApp y dirección con «Cómo llegar»                             |

### Etapa 2: piezas nuevas

Repositorio de recursos abiertos (la más grande), galería multimedia, kit de prensa y boletín. Dependen de las decisiones abiertas.

### Etapa 3: contenido y lanzamiento

Textos definitivos y cifras reales, dominio institucional, revisión manual con NVDA y TalkBack (lista en [`revision-lector-pantalla.md`](../revision-lector-pantalla.md)), WAVE y campaña de difusión.

## 6. Cómo se mide que está bien hecho

- axe sin violaciones críticas ni graves, en tema claro, oscuro y **alto contraste**, a 320 px y con el texto al 200 %.
- Lighthouse móvil: accesibilidad ≥ 95 y rendimiento ≥ 90.
- Todo lo nuevo se edita desde el panel y respeta los permisos (la edición no publica).
- La app Android y el contrato `GET /beacons/:major/:minor` no cambian.
