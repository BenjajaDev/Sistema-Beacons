# Bitácora: propuesta web de SIGNAL

Registro cronológico de lo que se hizo para llevar el sitio hacia la [propuesta](plan.md): qué se decidió, qué se construyó, cómo se comprobó y qué problemas aparecieron. Cada entrada se escribe cuando se termina el paso, no al final.

## Paso 0: lectura del documento y análisis

**Qué se hizo.** Se leyó la propuesta completa y se contrastó con el código actual: catálogo de secciones, modelos de datos, rutas públicas y controles de accesibilidad.

**Qué se encontró.**

- La paleta del documento ya es la del sitio; el único valor distinto es el Azul Claro (`#79ACF0` frente a `#9DC2F7` de la app).
- Las cifras de contraste del documento son correctas (cobalto sobre crema 7,51:1; violeta sobre crema 14,3:1).
- No existen: «En cifras», línea de tiempo, comité y estudiantes, repositorio de recursos, categorías de prensa, compartir, kit de prensa, galería, boletín, contacto segmentado, WhatsApp, alto contraste, fuente para dislexia ni guía de lectura.
- Glacial Indifference y Garet no están disponibles como paquete autoalojable; Red Hat Display y OpenDyslexic sí, con licencia libre.

**Decisiones.** Ver el [plan](plan.md#3-decisiones-de-diseño). Las cuatro abiertas (tipografías, azul claro, recursos y boletín) no bloquean la etapa 1, así que se mantiene lo existente.

## Paso 1: panel de accesibilidad

**Qué pedía el documento.** Una barra con tamaño de letra, modo de alto contraste (amarillo sobre negro), fuente para dislexia y guía de lectura lineal.

**Qué se construyó.**

- Botón **«Accesibilidad»** en el encabezado que despliega un panel con: tema de colores (claro, oscuro, según el sistema y **alto contraste**), interruptor de **fuente para dislexia**, interruptor de **guía de lectura** y «Restablecer todo». El zoom de la página se queda en el encabezado, a la vista, porque con el menú plegado hay que poder deshacerlo (ya existía así).
- **Alto contraste** como tercer tema: tema oscuro más el atributo `data-contraste`. Los colores salen de `HIGH_CONTRAST` en `server/src/content/theme.ts` y se generan en `theme-default.css`, igual que la paleta editable. Texto amarillo `#FFFF00` sobre negro (19,6:1), enlaces cian, foco cian, bordes amarillos.
- **Fuente para dislexia:** OpenDyslexic (`@fontsource/opendyslexic`, licencia libre), autoalojada. Reemplaza las dos familias del sitio y afloja el espaciado.
- **Guía de lectura:** oscurece la página salvo una franja que sigue al puntero (también al dedo) y, con teclado, al elemento enfocado. Es decorativa, no intercepta clics y no se anima.
- Las preferencias se guardan en `localStorage` (con respaldo en memoria si el navegador lo bloquea), se aplican antes del primer pintado con `theme-init.js` y todos los controles se actualizan solos al restablecer.
- El panel de administración ofrece también el alto contraste: comparte `localStorage` con el sitio, así que quien lo elige allí no se encuentra con un panel en un tema que no puede cambiar.

**Decisiones y por qué.**

- **Panel en el flujo de la página, no una barra flotante.** Una barra fija tapa contenido con zoom al 200 % y en móvil; el panel empuja el contenido y se recorre con Tab en orden. Escape lo cierra y devuelve el foco al botón.
- **Alto contraste ≠ modo oscuro.** El oscuro conserva la identidad de la marca; el alto contraste prioriza la lectura. Por eso no es editable desde Identidad visual.
- **OpenDyslexic como opción, no por defecto.** La evidencia de que mejore la lectura es limitada y Atkinson Hyperlegible ya está diseñada para baja visión.
- **La guía atenúa el resto de la página** (no la oculta): se acepta que el texto fuera de la franja pierda contraste porque la persona la activa a propósito para concentrarse; la franja conserva el contraste completo.

**Cómo se comprobó.**

- `HIGH_CONTRAST` cumple las reglas de contraste de la paleta editable y, además, **7:1 (AAA)** en texto, enlaces y estados (test en `server/test/content.test.ts`).
- Pruebas de unidad: selector de tema, restablecer, `theme-init.js`, panel (abrir, Escape, interruptores) y guía (siguen al puntero, desaparece al apagarla).
- e2e con axe: las cuatro páginas en alto contraste con la fuente para dislexia, a 320 px y con el panel abierto, sin desborde horizontal.
- Capturas en claro, oscuro, alto contraste, con la guía y en móvil.

**Problemas y cómo se resolvieron.**

- El contenedor de trabajo era nuevo y le faltaban dependencias (`zod`, `prisma`, `eslint`…): se reinstaló con `npm ci` y se recrearon `server/.env` y la base local.
- Las fuentes de dislexia (235 KB) entraron al precache del service worker y lo subieron de 614 a 896 KiB. Se excluyeron del precache y se guardan en caché solo la primera vez que alguien las usa.
- Las cuatro opciones de tema quedaban en filas desparejas en móvil: ahora van en cuadrícula.

## Paso 2: «En cifras», línea de tiempo e íconos en las tarjetas

**Qué pedía el documento.** Una sección de indicadores («En cifras»), una línea de tiempo con hitos y proyecciones, e íconos en los objetivos.

**Qué se construyó.**

- **Sección «En cifras»** (`cifras`): de 1 a 6 indicadores con número entero, un sufijo opcional («+», «%», «mil»), qué mide y un detalle opcional. Los miles se separan con punto (`1.250`).
- **Sección «Línea de tiempo»** (`hitos`): de 1 a 8 hitos con título, texto, fecha libre opcional y un estado: _Completado_, _En curso_ o _Próximamente_. Es una lista ordenada.
- **Íconos en tarjetas:** los objetivos, las proyecciones y los pasos de «Qué es» aceptan un ícono de una lista de 12 (brújula, voz, personas, mapa, libro, ojo, señal, escudo, idea, corazón, edificio, gráfico). Es una alternativa liviana a subir una imagen. Los dibujos son vectores propios (`IconosTarjeta.tsx`).
- **Panel:** los editores de las dos secciones nuevas (campos propios por elemento: número, estado…) y un selector de ícono con el dibujo y su nombre en cada tarjeta.

**Decisiones y por qué.**

- **Las dos secciones nacen ocultas.** Las cifras y los hitos son datos reales del proyecto y no se inventan: el contenido inicial son marcadores en cero que el equipo reemplaza, y solo entonces se publica la sección.
- **El número no se anima.** El plan hablaba de contadores que suben al entrar en pantalla, pero CLAUDE.md limita lo que se mueve solo en el sitio. El número aparece completo desde el primer pintado, que además es lo correcto para lector de pantalla, impresión y `prefers-reduced-motion`.
- **El estado de un hito se dice con tres cosas a la vez:** la palabra («Completado»), la forma del marcador (marca, anillo con punto, círculo punteado) y el color. Nada depende solo del color (WCAG 1.4.1).
- **Orden en bases existentes.** Una sección nueva del catálogo, en una base que ya tiene contenido, se agrega al final de su página en lugar de usar el número del catálogo, que podía coincidir con el de otra sección ya existente y dejar el orden ambiguo. Un test lo cubre (`section-images.test.ts`) y en una base vacía se respeta el orden del catálogo.
- **Los íconos se validan en el servidor** (lista cerrada) y un test verifica que la lista del servidor y los dibujos de la web coincidan.

**Cómo se comprobó.**

- Servidor: esquemas (enteros, rangos, estado válido, ícono de la lista), ocultas por defecto, orden en base existente y en base vacía; 522 pruebas en total.
- Web: renderizado de íconos, cifras (con separador de miles) e hitos (estado dicho en palabras, marcadores ocultos al lector), con axe; sincronía de la lista de íconos.
- e2e: el inicio con las dos secciones publicadas pasa axe en claro, oscuro, alto contraste, 320 px y texto al 200 %; en el panel, la administradora edita una cifra, ve el error de una cifra incompleta junto al campo, elige un ícono, publica y lo ve en el inicio. Las dos vistas nuevas entran al recorrido de axe del panel.
- Este paso no agrega movimiento (las cifras y la línea de tiempo son estáticas; las tarjetas conservan sus efectos al apuntar), así que no hubo cambio que revisar con `review-animations`.

**Problemas y cómo se resolvieron.**

- El test de sincronía no podía importar el código del servidor sin acoplar el typecheck de la web: lee la lista como texto.
- El e2e sirve el build compilado: con el build anterior las secciones nuevas no aparecían (la web ignora claves de sección que no conoce). Hay que ejecutar `npm run build -w apps/web` antes de `npm run e2e`.

## Paso 3: Nosotros con grupos, filiación y colaboradores por tipo

**Qué pedía el documento.** Distinguir en «Nosotros» al equipo, el comité consultivo y las y los estudiantes; mostrar la institución de cada persona; enlazar perfiles académicos (ORCID, ResearchGate); y presentar a las organizaciones aliadas por tipo, con los logos en gris que toman color al apuntarlos.

**Qué se construyó.**

- **Grupos de personas:** _Equipo_, _Comité consultivo_ y _Estudiantes_ (campo `category`, por defecto Equipo, así que lo que ya existía no cambia). En «Nosotros» cada grupo lleva su subtítulo (h3) y su propio carrusel; los nombres pasan a h4. Con un solo grupo no se agregan subtítulos.
- **Institución** de cada persona (`affiliation`), visible bajo su cargo y en la card del inicio.
- **ORCID y ResearchGate:** ya se pueden agregar como enlaces de una persona; el sitio reconoce el nombre o el dominio y les pone su ícono.
- **Colaboradores por tipo** (`type`): instituciones académicas, sociedad civil, sector público, empresas y tecnología, y otras (por defecto, para lo existente). Se agrupan con subtítulo; con un solo tipo no se rotula.
- **Logos en gris** que recuperan el color al apuntar o al enfocar con el teclado.
- **Panel:** el formulario de persona pide el grupo y la institución; el de colaborador, el tipo de organización.
- Migración `20261110120000_nosotros_grupos`: dos enums y tres columnas, todas con valor por defecto.

**Decisiones y por qué.**

- **El inicio muestra solo al equipo.** El comité y las y los estudiantes están en «Nosotros»: la fila circular del inicio es una presentación breve.
- **El gris es solo con puntero fino** (`hover: hover` y `pointer: fine`). Con el dedo no existe «apuntar», y dejar los logos grises para siempre los volvería ilegibles; en alto contraste tampoco se atenúan. Cambia de gris a color al instante, sin transición, así que no hay movimiento que revisar.
- **El tipo de colaborador es una lista cerrada** y no texto libre, para que los grupos queden siempre en el mismo orden y sin variantes («ONG», «Ong»…). Los respaldos del pie conservan su campo de texto libre, porque son otra cosa (ver CLAUDE.md).
- **Subtítulos solo si hay más de un grupo:** una página con un único grupo no debe tener un encabezado que no aporta.

**Cómo se comprobó.**

- Servidor: crear sin grupo cae en Equipo, grupo inválido se rechaza con el error junto al campo, editar otro dato no mueve de grupo, el tipo de colaborador se valida y se publica; la migración coincide con el esquema (`prisma migrate diff` sin diferencias).
- Web: niveles de encabezado con uno y con varios grupos, orden de los tipos con «otras» al final, grupos vacíos que no se muestran, reconocimiento de ORCID/ResearchGate y axe.
- e2e: desde el panel se crea una persona del comité con su institución y dos colaboradores de distinto tipo; «Nosotros» los agrupa con axe sin violaciones y el inicio no muestra al comité.

**Problemas y cómo se resolvieron.**

- `Respaldo` heredaba de `Colaborador` y ahora este tiene `type`: pasó a `Omit<Colaborador, "type">`, porque los respaldos no tienen tipo.
- Los tests e2e de «Nosotros» cuentan cinco tarjetas del equipo y el carrusel con su nombre original, así que los datos de prueba no se tocaron y el caso de los grupos se prueba creándolos desde el panel.

## Paso 4: sala de prensa y contacto segmentado

**Qué pedía el documento.** Cinco categorías de noticias, firma de autoría, botones para compartir, un motivo de consulta en el formulario, un botón de WhatsApp en Contacto y un mapa con la dirección.

**Qué se construyó.**

- **Cinco categorías fijas de noticias:** _Novedades_, _Eventos y talleres_, _Investigación_, _En los medios_ y _Comunidad y alianzas_. En el panel se elige de una lista; en «Noticias» hay un filtro con enlaces (`/noticias?categoria=…`) que funciona con «Atrás» y se puede compartir. La paginación conserva la categoría.
- **Firma de autoría:** la nota dice «Por Ana Rojas» junto a la fecha y el tiempo de lectura.
- **Compartir** en WhatsApp, LinkedIn y X con enlaces simples: no se carga ningún script de terceros, nada se envía hasta que la persona hace clic y cada enlace avisa que se abre en una pestaña nueva.
- **Motivo de la consulta** en el formulario (seis opciones, obligatorio). En la bandeja del panel cada mensaje muestra su motivo y se puede filtrar por él.
- **WhatsApp en Contacto:** botón destacado (no flotante) que sale de la red «WhatsApp» cargada en _Contacto y redes_ con un enlace `wa.me/…`; no hay un número más que mantener. Sin esa red, no aparece.
- **Dirección con «Cómo llegar»:** un enlace al mapa en una pestaña nueva, no un mapa embebido.
- Migración `20261110130000_motivo_de_contacto` (columna con valor por defecto «otro»).

**Decisiones y por qué.**

- **Las notas antiguas no se tocan.** La categoría seguía siendo texto libre. En vez de reescribir lo ya publicado, una nota conserva su categoría anterior mientras no la cambie (el selector la muestra como «(anterior)»), pero esa categoría ya no se puede asignar a otra nota. El filtro público ofrece solo las cinco.
- **El motivo es opcional para la API** (queda como «otro»), porque la app o un cliente anterior podrían enviar mensajes sin él; en el formulario del sitio sí es obligatorio.
- **Un enlace a Google Maps y no un iframe:** el iframe atrapa el foco del teclado, es difícil para lectores de pantalla y carga scripts de terceros que la política de seguridad no permite.
- **Las listas viven en dos lugares** (servidor que valida, web que muestra) y un test verifica que coincidan, el mismo patrón de los íconos.

**Cómo se comprobó.**

- Servidor: solo acepta las cinco categorías, respeta la antigua, el endpoint devuelve las fijas y las heredadas; el motivo se guarda, se filtra y rechaza uno inventado.
- Web: filtro (marca la elegida, ignora una inventada), firma y enlaces de compartir, formulario con motivo, WhatsApp y «Cómo llegar», listas sincronizadas con el servidor; todo con axe.
- e2e: el formulario exige el motivo; la nota publicada aparece solo en su categoría y muestra la firma y los tres enlaces; Contacto con WhatsApp y dirección (botón de al menos 44 px, sin `position: fixed`, sin iframe) pasa axe.

**Problemas y cómo se resolvieron.**

- Una prueba detectó que el lector de pantalla diría «Cómo llegara Av. …»: el espacio entre el texto visible y el oculto se perdía. Ahora el espacio va en el texto visible.
- Las pruebas de servidor y la nota de ejemplo usaban la categoría «Proyecto», que ya no es válida para notas nuevas: se actualizaron al nuevo conjunto.

## Cierre de la etapa 1

**Verificación final** (sobre el último commit de `develop`):

- Batería de la regla 5: lint, tipos, formato, 526 pruebas del servidor, 97 de la web, 43 del paquete compartido y build con la comprobación de que el bundle público no menciona el panel.
- e2e completo: 43 pruebas (landing, panel y PWA), con axe en claro, oscuro y alto contraste, a 320 px y con el texto al 200 %.
- Lighthouse móvil, mediana de tres corridas: rendimiento 95 a 97 y accesibilidad 100 en las cuatro páginas (umbrales 90 y 95, sin tocarlos).
- El contrato `GET /beacons/:major/:minor` de la app Android no cambió (`legacy-beacons.test.ts` y el e2e correspondiente pasan).
- Movimiento: lo único nuevo es el apuntado de los enlaces de «Compartir» (`transform`, `--dur-rapida`, solo con puntero fino y sin reducción de movimiento). La skill `review-animations` no estaba disponible en esta sesión, así que se revisó a mano contra las reglas de CLAUDE.md.

**Lo que queda.** Ver el [estado de la etapa 1](plan.md#7-estado-de-la-etapa-1).

---

# Etapa 2: piezas nuevas

El equipo no respondió las decisiones abiertas de la etapa 2 y pidió empezar. Se tomó, para cada una, la opción que **no cierra puertas** y que se puede cambiar después sin perder datos (ver [plan, decisiones](plan.md#4-decisiones-abiertas)).

## Paso 5: repositorio de recursos abiertos

**Qué pedía el documento.** Un repositorio de recursos abiertos (informes, artículos, guías) que haga del sitio un nodo de transferencia de conocimiento. Es la pieza más grande de la etapa 2.

**Decisión: ¿subir PDF o enlazar?** Las dos cosas. Cada recurso lleva un PDF subido al sitio, un DOI o un enlace a un repositorio institucional, y **al menos uno de los tres** (lo exige la API y también la base, con un `CHECK`). Así un informe propio se sube y un artículo ya publicado se enlaza por su DOI, sin duplicar el archivo.

**Qué se construyó.**

- **Modelo `Resource`** (tabla `resources`, migración `20261111120000_recursos`): título, descripción, tipo, autoría, fecha de publicación (del documento, no de la carga), DOI, enlace, licencia, PDF y visibilidad. Cinco tipos fijos: _Informe_, _Artículo científico_, _Guía y manual_, _Kit de prensa_ y _Otro_. La lista vive en servidor y web, con un test que las compara (mismo patrón que los íconos y las categorías).
- **Subida de PDF** (`POST /api/admin/documents`): el servidor comprueba que el contenido empiece con `%PDF-`, no solo el nombre ni el tipo que declara el navegador; guarda el archivo sin pasarlo por el procesador de imágenes y lo registra en la tabla `media`. Tamaño máximo nuevo: `DOCUMENT_MAX_MB` (20 por defecto, hasta 50), porque un informe pesa más que una foto.
- **DOI limpio:** se acepta el DOI suelto o el enlace de doi.org y se guarda solo el DOI.
- **Panel «Recursos»** (editores y administradores, como el equipo): lista, alta y edición en un diálogo, interruptor de visibilidad y borrado con confirmación. Reutiliza la lista de colecciones; se agregó la opción de no mostrar ↑ ↓, porque esta lista se ordena sola por fecha.
- **Página pública `/recursos`** con encabezado editable desde _Secciones_ (página nueva «Recursos»), búsqueda por título, autoría o descripción, filtro por tipo con enlaces y paginación. Cada recurso es una tarjeta con título (`h2`), tipo, fecha, autoría, licencia y los botones que correspondan: _Abrir PDF (2,3 MB)_, _Ver por DOI_ y _Ver en el repositorio_. Todos avisan que se abren en una pestaña nueva y tienen al menos 44 px.
- **El menú enlaza a Recursos solo si hay alguno visible.** `GET /api/public/site` trae `modulos.recursos`; así el sitio no muestra una página vacía mientras el equipo carga los primeros documentos.
- La ruta entra al sitemap y se sirve con sus datos iniciales en el HTML, igual que las demás.

**Decisiones y por qué.**

- **Los PDF no aparecen en la biblioteca de imágenes.** `GET /media` ahora devuelve solo imágenes; de lo contrario, al elegir una portada se verían PDF.
- **Al reemplazar o borrar un recurso se borra su PDF** (registro y archivo) si ningún otro lo usa, para no acumular huérfanos en el almacenamiento.
- **La fecha de un día se muestra en UTC.** `2026-06-01` interpretado en horario de Chile mostraría el 31 de mayo; hay un componente `FechaDia` y una prueba que lo cubre.
- **Región de estado persistente.** El conteo de resultados («3 recursos») se anuncia desde una región que existe siempre; una región insertada al cargar no la leen todos los lectores.
- **Sin visor de PDF embebido.** Un `iframe` de PDF atrapa el teclado y no lo leen bien los lectores de pantalla; el PDF se abre en una pestaña nueva con el visor del navegador.
- **Accesibilidad del archivo.** El panel recuerda que el PDF debe tener texto seleccionable y encabezados marcados. No se puede verificar automáticamente: queda como tarea de quien sube.

**Cómo se comprobó.**

- Servidor (12 pruebas nuevas): sube y sirve un PDF; rechaza HTML o imágenes con nombre `.pdf`; exige archivo, DOI o enlace y valida cada campo; no acepta una imagen como archivo; publica solo lo visible, ordenado por fecha, con filtro y búsqueda y sin ids; el menú depende de que haya recursos; borra el PDF al reemplazar o borrar; bitácora y roles (`SOCIAL` recibe 403); HTML y sitemap.
- Web (4 pruebas nuevas y la lista compartida): tarjetas con sus tres accesos, fecha sin desfase, tipo marcado, tipo inventado ignorado, estado anunciado, buscador y menú condicionado; todo con axe.
- e2e: la página pasa axe en claro y oscuro, sin scroll horizontal a 320 px y con el texto al 200 %; filtro y búsqueda; el editor sube un PDF, rechaza uno falso y lo ve publicado.

**Problemas y cómo se resolvieron.**

- Al ejecutar Prettier desde un subdirectorio se reformatearon documentos ajenos; se revirtieron y desde entonces se formatea solo desde la raíz.
- Las pruebas buscaban `role="status"` y encontraban también el del panel de accesibilidad; ahora consultan la región por su clase.

## Paso 6: galería de fotos

**Qué pedía el documento.** Una galería multimedia con fotos y videos del proyecto.

**Decisión: solo fotos, por ahora.** Un video exige subtítulos (WCAG 1.2.2), audiodescripción o transcripción (1.2.3 y 1.2.5), y hoy el sitio no puede cargar reproductores de terceros (la política de seguridad no lo permite). Si el equipo tiene videos, lo más seguro es publicarlos en su plataforma con subtítulos y enlazarlos desde una noticia o un recurso. Queda como tarea de la etapa 3.

**Qué se construyó.**

- **Modelo `GalleryItem`** (tabla `gallery_items`, migración `20261111130000_galeria`): foto, pie de foto, crédito opcional, orden y visibilidad. El **texto alternativo es siempre obligatorio** (no existe la opción «decorativa»: la galería es contenido) y la base lo exige con un `CHECK`.
- **Panel «Galería»** (editores y administradores): usa la misma lista ordenable que el equipo y los respaldos, con ↑ ↓, interruptor de visibilidad y borrado con confirmación. Sin el texto alternativo no se guarda y el error queda junto al campo.
- **Página pública `/galeria`** con encabezado editable desde _Secciones_ (página nueva «Galería»). Cada foto es una `figure` con su pie, el crédito, el botón para **escuchar la descripción** (el mismo de las demás imágenes del sitio) y un enlace «Ver en tamaño completo» que abre la imagen en una pestaña nueva.
- **El menú enlaza a la Galería solo si hay fotos visibles** (`modulos.galeria` en los datos del sitio), igual que Recursos.
- Una imagen usada en la galería no se puede borrar de la biblioteca: el aviso dice «la foto «…» de la galería».

**Decisiones y por qué.**

- **Sin visor ampliado (lightbox).** Un visor modal añade una trampa de foco, flechas y cierre con Escape que hay que mantener en cada tema y tamaño. Con las fotos a buen tamaño y el enlace al tamaño completo se cubre la necesidad con menos riesgo; si el equipo lo pide, se agrega después.
- **Recorte 4:3 en la cuadrícula** para que las filas queden parejas; la foto completa está en el enlace.

**Cómo se comprobó.**

- Servidor (7 pruebas nuevas): exige foto, pie y texto alternativo; publica solo lo visible y en el orden del panel, sin ids; se reordena; no se puede quitar el texto alternativo al editar; no se borra una imagen en uso; bitácora y roles; HTML y sitemap.
- Web (3 pruebas): fotos con alt, pie, crédito y enlace; estado vacío; menú condicionado; todo con axe.
- e2e: axe en claro y oscuro, 320 px y texto al 200 %; el editor agrega una foto (se rechaza sin descripción) y la ve en la página pública.

**Problemas y cómo se resolvieron.**

- Una prueba con nombre accesible exacto mostró «Ver en tamaño **completola** foto…»: el espacio inicial de un texto oculto se pierde. Es la misma trampa de «Cómo llegara…» del paso 4; el espacio va ahora en el texto visible. La prueba reveló que **Recursos tenía el mismo descuido** («DOI: 10.1234/abcdde…»): se corrigió y las pruebas de ambos usan ahora el nombre completo.

## Paso 7: boletín con consentimiento y baja

**Qué pedía el documento.** Un boletín para mantener informada a la comunidad. El plan marcó como condición que cumpla la ley chilena de datos personales: consentimiento y baja.

**Decisión: ¿base propia o servicio externo?** Base propia. Un servicio externo (Mailchimp y similares) implica enviar los correos de las personas a un tercero, cargar scripts que la política de seguridad del sitio no permite y depender de una cuenta aparte. Con la base propia el dato queda en el mismo lugar que el resto y el equipo decide después a qué herramienta de envío llevarlo. **Desde el panel no se envía nada**: se descarga la lista y se usa en la herramienta de correo del equipo.

**Qué se construyó.**

- **Modelo `Subscriber`** (migración `20261112120000_boletin`): correo en minúsculas (único, con `CHECK`), nombre opcional, **fecha y texto exacto del consentimiento**, fecha de baja y un secreto para el enlace de baja. Con seguridad a nivel de fila (RLS) y sin acceso desde la Data API de Supabase, como el resto de las tablas.
- **Sección «Boletín»** en el inicio, editable desde _Secciones_ (título, bajada, texto de la casilla, aviso de privacidad, texto del botón y mensaje de éxito). **Nace oculta**: antes de mostrarla, el equipo revisa los textos de consentimiento.
- **Formulario público:** correo, nombre opcional y una casilla **sin marcar** con el texto de consentimiento. Sin la casilla no se suscribe a nadie (lo exigen el formulario y la API). Con pocos campos, los errores se dicen junto a cada campo y el foco va al primero; la confirmación recibe el foco. Incluye el campo trampa y un límite de 6 solicitudes por hora por conexión.
- **El texto que se guarda es el del servidor**, no el que mande el navegador: si el equipo cambia la casilla, las nuevas suscripciones guardan el texto nuevo y las antiguas conservan el que aceptaron.
- **Baja con enlace secreto** (`/boletin/baja?t=…`). Abrir el enlace **no** da de baja: hay que pulsar «Darme de baja», porque los programas de correo y antivirus abren los enlaces por su cuenta. La página no se indexa, no entra al sitemap y no envía el _referrer_ a otros sitios. Si el enlace es inválido, ofrece el correo de contacto para pedir la baja a mano.
- **Panel «Suscriptores»** (administración y comunicación; la edición de contenido no ve datos personales): lista paginada con filtro _suscritas / dadas de baja / todas_ (el estado se dice con texto), contador, **descarga CSV** de las personas activas con su enlace de baja, y eliminación total (derecho de supresión).
- **Bitácora de auditoría sin datos personales:** registra cuántos correos se descargaron y quién lo hizo, pero nunca los correos.

**Decisiones y por qué.**

- **Una baja no borra la fila.** Así no se le vuelve a escribir a quien pidió no recibir más. Si la persona vuelve a suscribirse, es un consentimiento nuevo (fecha y texto nuevos). Para borrar los datos por completo, existe «Eliminar».
- **Respuesta idéntica si el correo ya estaba.** El formulario no revela quién está suscrito.
- **El CSV neutraliza fórmulas.** Un nombre como `=HYPERLINK(…)` se exporta como texto, no como fórmula de Excel; lleva la marca de orden de bytes para que las tildes se lean bien.
- **El enlace de baja viaja en el CSV**, y el panel recuerda incluirlo en cada envío.

**Lo que falta, y es del equipo (no se puede resolver solo con código).**

- **No hay correo de confirmación (doble opt-in).** El servidor no tiene envío de correo. Mientras tanto, alguien podría escribir el correo de otra persona. Antes del primer envío conviene confirmar las direcciones o activar un servicio de envío con confirmación.
- **Revisión legal.** El aviso de privacidad y el texto de la casilla son un punto de partida. Los debe revisar quien asesore al equipo en la ley de datos personales (la 19.628 y su reemplazo, la 21.719).

**Cómo se comprobó.**

- Servidor (11 pruebas): exige consentimiento y correo válido; guarda en minúsculas con el texto aceptado; usa el texto y el mensaje del panel; responde igual al repetir; campo trampa; baja con el enlace secreto (404 si es falso, repetirla no cambia nada) y reactivación con consentimiento nuevo; límite por conexión; roles; lista sin el secreto; CSV solo con activas, sin fórmulas y con el registro de auditoría sin correos; eliminación; sección oculta y página de baja sin indexar.
- Web (7 pruebas): casilla sin marcar con su aviso, errores y foco, envío, error del servidor, baja con confirmación, enlace inválido y red caída; todo con axe.
- e2e: el boletín desde el inicio (errores, foco, confirmación) y, en el panel, el flujo completo: alta, lista, descarga del CSV, baja con el enlace descargado y cambio a «dadas de baja».

**Problemas y cómo se resolvieron.**

- El correo con espacios alrededor fallaba la validación del servidor; ahora se recorta antes de validar.
- Un resumen de errores con `h2` dentro de una sección del inicio rompía el orden de encabezados; con solo tres campos se optó por errores junto a cada campo y foco al primero.

## Paso 8: kit de prensa y cierre de la etapa 2

**Qué pedía el documento.** Un kit de prensa para periodistas: texto oficial, contacto y material descargable.

**Qué se construyó.** Sin una página nueva ni un modelo nuevo: el kit reutiliza lo que ya existe.

- **Sección «Kit de prensa»** (página Noticias, editable desde _Secciones_, **nace oculta**): título, bajada, el texto «Quiénes somos, en breve» para citar tal cual, persona y correo de prensa.
- **Material para descargar:** son los **recursos del tipo «Kit de prensa»** (el mismo repositorio del paso 5, con PDF o enlace). El bloque lista solo esos.
- **Logotipos:** salen de _Identidad visual_ (claro y oscuro, el que esté cargado), sobre una placa blanca para que se vean igual en los dos temas. No hay otro lugar donde mantenerlos.
- **Dónde se ve:** al final de «Noticias», después del listado. Los archivos del kit llegan con el HTML del servidor, como los demás datos de la página.

**Decisiones y por qué.**

- **Al final de Noticias y no en una página propia:** el público del kit (periodistas) ya llega a Noticias, y una página más es otro enlace en el menú y otra ruta que mantener.
- **Sin botón «copiar texto».** El texto se puede seleccionar y copiar; un botón agrega JavaScript y un aviso de «copiado» que hay que anunciar.

**Verificación de cierre** (sobre el último commit de `develop`):

- Batería de la regla 5: lint, tipos, formato, 612 pruebas del servidor, 114 de la web, 43 del paquete compartido y build con la comprobación de que el bundle público no menciona el panel.
- e2e completo: 53 pruebas, con axe en claro, oscuro y alto contraste, a 320 px y con el texto al 200 %.
- Lighthouse móvil, mediana de tres corridas, en seis páginas (se agregaron `/recursos` y `/galeria`): rendimiento 96 a 97 y accesibilidad 100 en todas. Los umbrales (90 y 95) no se tocaron.
- El contrato `GET /beacons/:major/:minor` de la app Android no cambió.

**Problemas y cómo se resolvieron.**

- El e2e de alto contraste con la fuente para dislexia detectó **46 px de desborde horizontal a 320 px** en `/recursos`: el buscador no encogía. Se agregó `min-width: 0` al campo. De paso, con seis enlaces en el menú se ajustó el relleno de la barra de navegación en escritorio para que quepan en una fila con esa fuente (más ancha).
- Una prueba del panel descargaba el CSV y daba de baja a la primera persona de la lista, no a la que acababa de crear; ahora busca su propia fila.
- Otra vez el espacio perdido ante un texto oculto («Logotipo para fondo claro(se abre…»): lo detectó la prueba con el nombre accesible exacto y se corrigió. Ya son tres veces en la etapa; está en las trampas de `CLAUDE.md`.

---

# Identidad del documento

## Paso 9: azul claro y tipografías de la propuesta

**Decisiones del equipo.** «Prioriza la identidad del documento», «el azul que plantea el documento», «los recursos los subimos nosotros, los PDF» y «el boletín lo guardamos en nuestra base». Las dos últimas coinciden con lo que ya estaba hecho (pasos 5 y 7); las dos primeras cambian la identidad visual.

**Azul Claro `#79ACF0`.**

- Reemplaza a `#9DC2F7` en **los dos lados**, en el mismo cambio: `SignalColors.kt` (`BlueLight`) en la app Android y `DEFAULT_PALETTE` en la web, más `tokens.css`, `offline.html` (de ahí salen `404.html` y `sin-servidor.html`) y `gen-icons.mjs`. Se regeneraron los íconos de la PWA y `theme-default.css`.
- El documento lo describe como «bajo contraste para texto sobre blanco: reservar para decoración y contenedores oscuros». En el sitio solo se usa sobre fondos oscuros (texto, enlaces y foco del tema oscuro), donde da más de 7:1; `checkPaletteContrast` sigue pasando.
- **Migración `20261113120000_identidad_del_documento`:** actualiza las bases existentes, pero **solo** si siguen con el valor anterior (`#9DC2F7`, o las fuentes por defecto de antes). Un color o una fuente que el equipo eligió a mano no se toca. Sin esta migración habría que pulsar «Volver a los colores y tipografías por defecto» en cada base.

**Tipografías.**

- **Red Hat Display** (licencia libre, autoalojada, variable con cursiva) pasa a ser la fuente del texto, como pide el documento, y por ahora también de los títulos. Atkinson Hyperlegible Next y Bricolage Grotesque siguen disponibles en Identidad visual; la de dislexia no cambia.
- **Glacial Indifference** (títulos) y **Garet** (subtítulos y botones) **no se pudieron incorporar**: no están en npm y descargarlas sin ver su licencia no es una opción. Quedaron documentadas, con los pasos exactos, en [tipografías](tipografias.md). Hace falta que el equipo aporte los archivos con licencia de uso web.
- El cuerpo (17 px) y el interlineado (1,6) ya eran los del documento; los títulos usan escalas fluidas que contienen sus rangos.

**Cómo se comprobó.** Batería completa en verde (612, 114 y 43 pruebas, con el chequeo de contraste de la paleta), e2e completo (53 pruebas, con axe en claro, oscuro y alto contraste) y Lighthouse móvil en seis páginas: rendimiento 97 a 98 y accesibilidad 100.

**Pendiente del equipo.** Los archivos con licencia de Glacial Indifference y Garet (ver [tipografías](tipografias.md)). La app Android debe recompilarse para tomar el nuevo `BlueLight`.
