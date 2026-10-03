# Revisión manual con lector de pantalla

Las pruebas automáticas (axe en Playwright y Lighthouse) detectan alrededor de un
tercio de los problemas de accesibilidad. Esta lista cubre el resto: cómo se
**escucha** y se **opera** el sitio con lector de pantalla. Hazla antes de cada
publicación importante y anota el resultado.

- **NVDA** (Windows, gratuito): con Firefox o Chrome. Teclas útiles: `H` siguiente
  título, `D` siguiente región, `K` siguiente enlace, `F` siguiente campo,
  `Insert+F7` lista de elementos, `Insert+Espacio` alterna modo foco/exploración.
- **TalkBack** (Android): con Chrome. Deslizar a derecha/izquierda recorre
  elementos; con el menú de lectura (deslizar arriba y abajo) se cambia a
  «Encabezados» o «Controles».

Marca cada punto con ✅ (bien), ⚠️ (funciona pero confunde) o ❌ (no funciona), y
anota qué se escuchó.

## Landing

| # | Qué hacer | Qué debe pasar | NVDA | TalkBack |
|---|---|---|---|---|
| 1 | Abrir el inicio y pulsar Tab una vez | Se anuncia «Saltar al contenido, enlace» y se ve; Enter lleva al contenido principal | | |
| 2 | `Insert+F7` → Encabezados (TalkBack: menú → Encabezados) | Un solo título de nivel 1; las secciones son nivel 2 y sus tarjetas nivel 3, sin saltos | | |
| 3 | Recorrer regiones con `D` | Banner, navegación «Principal», principal y pie de página, en ese orden | | |
| 4 | En la navegación, llegar a la página actual | Se anuncia «página actual» en el enlace de la sección abierta | | |
| 5 | Pulsar «Nosotros» en el menú | Se anuncia el título de la nueva página (el foco va a su h1) | | |
| 6 | En móvil, activar «Menú» | Se anuncia «Menú, botón, contraído/expandido»; Escape (o atrás) lo cierra | | |
| 7 | Grupo «Tema de colores» | Se anuncia como grupo de 3 opciones con la elegida marcada; las flechas cambian | | |
| 8 | Botones A− / A+ | Al pulsar se anuncia «Texto al 113 %», etc. En el límite siguen enfocables | | |
| 9 | Noticias: recorrer la lista | Cada tarjeta anuncia su título como enlace una sola vez (no tres enlaces repetidos) | | |
| 10 | Paginación | «Paginación de noticias, navegación»; la página actual se anuncia como actual | | |
| 11 | Abrir una noticia con imágenes | Cada imagen lee su texto alternativo; el pie de foto se lee después | | |
| 12 | Contacto: enviar el formulario vacío | Se anuncia el resumen de errores; cada error es un enlace que lleva a su campo | | |
| 13 | Contacto: escribir un correo inválido y salir del campo | Al volver al campo se lee su error junto con la etiqueta | | |
| 14 | Contacto: enviar correctamente | Se anuncia el mensaje de confirmación | | |
| 15 | Ampliar el texto al 200 % (Ctrl + `+`) | Nada se corta ni se superpone; no aparece scroll horizontal | | |

## Panel

| # | Qué hacer | Qué debe pasar | NVDA | TalkBack |
|---|---|---|---|---|
| 16 | Iniciar sesión con una contraseña incorrecta | Se anuncia «Correo o contraseña incorrectos…» de inmediato | | |
| 17 | Botón «Mostrar contraseña» | Se anuncia como botón de alternancia (presionado / no presionado) | | |
| 18 | Navegar entre vistas desde el menú «Panel» | Cada vista anuncia su título al abrirse | | |
| 19 | Noticias → Nueva noticia: Tab hasta el editor | La barra se anuncia como «barra de herramientas»; un Tab entra y las flechas recorren los botones | | |
| 20 | Activar «Negrita» | Se anuncia «Negrita (Ctrl+B), botón de alternancia, presionado» | | |
| 21 | Escribir en el cuerpo | Se anuncia «Cuerpo de la nota, edición, multilínea» y lo escrito | | |
| 22 | Insertar una imagen sin texto alternativo | El diálogo no la inserta y se lee el error | | |
| 23 | Guardar y publicar | Cada acción anuncia su resultado (aviso de estado) | | |
| 24 | Borrar un beacon | Se abre un diálogo de alerta con el foco en «Cancelar»; Escape lo cierra y el foco vuelve al botón | | |
| 25 | Interruptor «Visible» en Secciones | Se anuncia como «interruptor, activado/desactivado» con el nombre de la sección | | |
| 26 | Subir/Bajar una sección | Se anuncia la nueva posición («ahora es la sección 2 de 5») | | |
| 27 | Identidad visual: cambiar un color a uno sin contraste | La lista de contraste anuncia «no cumple» en esa combinación | | |
| 28 | Usuarios: crear una cuenta | El diálogo con la contraseña temporal se anuncia; «Copiar» confirma «Contraseña copiada» | | |
| 29 | En el teléfono, abrir el menú del panel | El cajón atrapa el foco; atrás/Escape lo cierra | | |

## Registro

| Fecha | Persona | Lector y navegador | Resultado | Problemas encontrados |
|---|---|---|---|---|
| | | | | |
