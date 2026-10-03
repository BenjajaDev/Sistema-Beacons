# Estrategia de redacción para mensajes de audiodescripción

Guía para quien escriba o edite el campo **Descripción** de un beacon en el
panel de administración (vista **Beacons**, `apps/web/src/admin/views/Beacons.tsx`). Ese texto es el mensaje que la app
SIGNAL convierte en voz cuando una persona con discapacidad visual se acerca
a un punto. Escribirlo bien no es un detalle de redacción: es la única
información que esa persona va a recibir sobre dónde está.

## 1. Un hecho técnico que cambia cómo hay que escribir

En el CMS cada beacon tiene tres campos: **Título**, **Descripción** y
**Ubicación**. Los tres se ven en el panel administrativo. Pero en la app,
cuando el lector de pantalla (TalkBack) anuncia la tarjeta de "beacon
detectado" y cuando SIGNAL lo lee en voz alta, **solo se anuncia el campo
Descripción** (`BeaconViewModel.kt` lo asigna a `ttsMessage` y es lo único
que pasa por `speakInternal(...)` y por el `contentDescription` de la
tarjeta). Título y Ubicación son apoyo visual para quien ve la pantalla —
para quien no la ve, no existen.

**Consecuencia directa:** la Descripción tiene que ser autocontenida. No
puede dar por hecho que la persona ya sabe dónde está porque "lo dice el
título". Si el lugar tiene un nombre, ese nombre va dentro de la
Descripción, con sus propias palabras — no basta con que esté en el campo
Título.

> Ejemplo real ya cargado en `server/prisma/data/beacons.json` (beacon
> `1-1`): el Título dice *"Oficina de reuniones"*, pero la Descripción dice
> *"Estás en el cuarto piso, en la oficina del living lab..."* sin nombrarla.
> Una persona vidente ve igual el título arriba de la tarjeta. Una persona
> que solo escucha el mensaje nunca oye la palabra "Oficina de reuniones".
> Corregido, la Descripción debería abrir con el nombre: *"Estás en la
> Oficina de Reuniones del Living Lab, cuarto piso..."*

## 2. Sin brújula: no prometer una dirección que la app no puede confirmar

SIGNAL detecta *cercanía* (por RSSI), no *orientación*. No sabe hacia dónde
mira la persona. Por eso:

- **Evitar** "gira a la izquierda", "sigue de frente" como instrucción suelta
  — asumen una dirección de llegada que puede no ser la real.
- **Usar** referencias ancladas a un punto de entrada predecible y fijo
  ("al entrar por la puerta principal, el mesón queda de frente") y, siempre
  que el mensaje incluya una referencia direccional, dejar explícito desde
  dónde se cuenta esa dirección. Si un lugar tiene más de un acceso habitual,
  no es un buen candidato para instrucciones de izquierda/derecha: mejor
  describir el elemento por lo que es y por su relación con otro punto fijo
  cercano ("el ascensor está pegado a la escalera principal").
- Preferir **distancias y pasos aproximados** ("unos 40 pasos") sobre
  direcciones relativas al cuerpo, y combinarlos con un punto de referencia
  fijo, nunca con personas o mobiliario que se mueve.

## 3. Principios de redacción

1. **Orientar primero, describir después.** La primera frase responde
   "¿dónde estoy?". Los detalles ambientales van después, si es que aportan
   algo útil para desplazarse (no para "ambientar").
2. **Una idea por mensaje.** Nombre del lugar + qué es + (si aplica) cómo
   seguir. Nada de historia institucional ni datos que no ayuden a caminar.
3. **Segunda persona, presente, frases cortas.** "Estás en...", "A tu
   derecha...", "Frente a ti...". Frases de 8–15 palabras: se transcriben
   mejor a voz y se recuerdan mejor.
4. **Elementos fijos, no variables.** Puertas, mesones, escaleras, ascensores,
   columnas: sirven de referencia. Personas, sillas, carteles temporales o
   "el puesto de café": no, porque pueden no estar.
5. **Riesgos primero.** Si hay un desnivel, una puerta de vidrio, escalones
   sin baranda o un cambio de piso, esa advertencia va en la primera frase,
   no al final.
6. **Nombrar el lugar dentro del texto.** Por la razón del punto 1: el
   Título no se escucha. Si hace falta un nombre corto para hablar
   ("recepción", "el hall"), inclúyelo también ahí para que TalkBack lo lea
   igual al enfocar la tarjeta completa.
7. **Corto de verdad.** Ver sección 4 sobre tiempos.

## 4. Longitud: por qué importa más de lo que parece

- SIGNAL vuelve a evaluar qué beacon está "enganchado" cada 250 ms y, si la
  persona pasa a otro punto, la nueva locución **interrumpe** a la que
  estuviera sonando (`TextToSpeech.QUEUE_FLUSH`). Un mensaje largo corre más
  riesgo de quedar cortado a la mitad si hay varios beacons próximos entre
  sí.
- Un mismo beacon no se vuelve a anunciar antes de 8 segundos
  (`REANNOUNCE_COOLDOWN_MS`), y la velocidad de lectura es ajustable por la
  persona usuaria (0.5×–2.5×, ver Ajustes). Calcula el mensaje para la
  velocidad **más lenta**, no la que uses tú al probarlo.
- **Regla práctica:** 2–3 frases cortas, ~25–35 palabras en total. Si no
  cabe la idea completa ahí, es una señal de que el mensaje intenta cubrir
  más de un punto de decisión — probablemente faltan beacons intermedios, no
  más texto en uno solo.

## 5. Plantilla

```
[Nombre del lugar] + [qué es / para qué sirve] + [cómo seguir, si aplica]
```

- **Nombre del lugar**: el mismo que usarías si alguien te preguntara "¿dónde
  estoy?". Puede repetir o no el Título — pero tiene que estar en el texto.
- **Qué es**: una frase que ubique el lugar dentro del edificio (piso, ala,
  junto a qué otro punto conocido).
- **Cómo seguir** (opcional): solo si hay una referencia fija y confiable
  hacia el siguiente punto útil. Si no la hay, se omite — es mejor no decir
  nada que dar una dirección poco confiable.

## 6. Ejemplos

| | Texto | Por qué |
|---|---|---|
| ❌ | "Living Lab" | No es una frase hablada, no orienta, no dice qué hacer con la información. |
| ❌ | "Estás cerca de la entrada" | "Cerca" no dice a cuánto ni de qué lado; no nombra el lugar. |
| ❌ | "Gira a la izquierda y sigue 10 metros" | Asume una dirección de llegada que la app no puede confirmar. |
| ✅ | "Estás en la entrada principal de la sede Alameda. La puerta de acceso está justo frente a ti." | Nombra el lugar, orienta, usa una referencia fija. |
| ✅ | "Estás en recepción de la Facultad de Trabajo Social. El mesón de atención queda al frente; el pasillo hacia las oficinas empieza a tu izquierda según entras por la puerta principal." | Nombra el lugar, dos referencias fijas, deja explícito desde dónde se cuenta la izquierda. |
| ✅ | "Cuidado: escalón de bajada. Estás llegando al acceso lateral del edificio, junto al estacionamiento de bicicletas." | Riesgo primero, lugar nombrado, referencia fija. |

## 7. Checklist antes de guardar en el CMS

- [ ] El nombre del lugar aparece **dentro del texto de Descripción** (no
      solo en Título).
- [ ] La primera frase responde "¿dónde estoy?" (o, si hay riesgo, lo
      advierte primero).
- [ ] Ninguna instrucción de dirección depende de por dónde llegó la
      persona, salvo que se aclare explícitamente el punto de partida.
- [ ] Las referencias usadas son fijas (puertas, muros, escaleras), no
      mobiliario o gente.
- [ ] Se puede leer en voz alta, sin apurarse, en menos de ~10 segundos.
- [ ] Se probó con TalkBack activado: activar el beacon (o revisar en
      Ajustes → Calibración con el teléfono cerca) y escuchar el mensaje
      completo, no solo leerlo en la pantalla.
- [ ] Si el lugar cambió (obra, mueble movido, puerta clausurada), el texto
      se actualizó — un mensaje desactualizado es peor que no tener beacon.

## 8. Validación

Ningún texto se da por bueno solo porque suena razonable en el CMS. Antes de
publicar un lote de beacons nuevos o corregidos:

1. Recorrer el espacio real con la app y TalkBack activo (o con una persona
   usuaria de bastón/perro guía, si es posible) para confirmar que el
   mensaje llega a tiempo y con sentido según la velocidad de acercamiento
   normal.
2. Verificar que dos beacons contiguos no generen mensajes contradictorios
   entre sí (p. ej. uno dice "el ascensor está a la derecha" y el de al lado
   asume otra referencia).
3. Priorizar la revisión con personas con discapacidad visual reales por
   sobre la revisión solo interna: son quienes detectan si una referencia
   "fija" en verdad no ayuda a ubicarse sin vista.
