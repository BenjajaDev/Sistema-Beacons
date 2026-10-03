# Diagramas de SIGNAL

Tres diagramas del sistema, también disponibles en el tablero de Miro [SIGNAL · Diagramas del sistema](https://miro.com/app/board/uXjVEen-r6k=/).

Cada diagrama tiene su fuente Mermaid (`.mmd`), que es la que se edita, y dos imágenes generadas a partir de ella (`.svg` y `.png`). GitHub muestra el Mermaid de este archivo directamente.

Para regenerar las imágenes después de editar un `.mmd`:

```bash
cd docs/diagramas
npx -y @mermaid-js/mermaid-cli -b white -i flujo-funcionamiento.mmd -o flujo-funcionamiento.svg
npx -y @mermaid-js/mermaid-cli -b white -s 2 -i flujo-funcionamiento.mmd -o flujo-funcionamiento.png
```

## 1. Arquitectura general

Quiénes usan SIGNAL y cómo se conectan las piezas: los beacons del edificio, la app Android, el sitio público, el panel, el servidor y los datos.

```mermaid
flowchart LR
    classDef persona fill:#B3E65F,stroke:#6E9A24,color:#2F440B
    classDef componente fill:#FFE86D,stroke:#A28E26,color:#574900
    classDef externo fill:#DDDDD8,stroke:#8A8A7E,color:#434339

    usuaria(["Persona con discapacidad visual"]):::persona
    visitante(["Público del sitio"]):::persona
    equipo(["Equipo SIGNAL<br/>ADMIN y EDITOR"]):::persona

    beacon["Beacons BLE<br/>iBeacon en el edificio"]:::externo
    app["App Android SIGNAL<br/>detecta, decide y habla"]:::componente
    web["Sitio web y PWA<br/>landing pública"]:::componente
    panel["Panel de administración<br/>ruta oculta"]:::componente
    servidor["Servidor SIGNAL<br/>Node.js, Express 5, Prisma 7"]:::componente
    datos[("PostgreSQL<br/>Supabase")]:::externo
    archivos[("Imágenes<br/>Supabase Storage")]:::externo

    beacon -->|"anuncio BLE: UUID, major, minor, potencia"| app
    usuaria -->|"lleva el teléfono"| app
    app -->|"voz y vibración"| usuaria
    app -->|"GET /beacons/major/minor"| servidor
    visitante -->|HTTPS| web
    equipo -->|HTTPS| panel
    web -->|"/api/public"| servidor
    panel -->|"/api/admin"| servidor
    servidor --> datos
    servidor --> archivos
```

Imagen: [`arquitectura-general.svg`](arquitectura-general.svg) · [`arquitectura-general.png`](arquitectura-general.png)

## 2. Arquitectura estructurada

Los componentes internos de cada pieza: la cadena de la app Android (escaneo BLE, filtro de distancia, decisión y voz), los dos builds del navegador, las capas del servidor y dónde vive cada dato.

```mermaid
flowchart LR
    classDef componente fill:#FFE86D,stroke:#A28E26,color:#574900
    classDef externo fill:#DDDDD8,stroke:#8A8A7E,color:#434339
    classDef seguridad fill:#9CE6FF,stroke:#2C97BB,color:#1C4657

    subgraph fisico["Espacio físico"]
        beacon["Beacon iBeacon<br/>UUID, major, minor, txPower"]:::externo
    end

    subgraph android["App Android: Kotlin y Jetpack Compose"]
        scanner["BeaconScanner<br/>escaneo BLE de baja latencia<br/>y lectura del paquete iBeacon"]:::componente
        tracker["BeaconDistanceTracker<br/>ventana de RSSI de 4 s sin extremos<br/>modelo log-distancia a metros"]:::componente
        vm["BeaconViewModel<br/>decide cada 250 ms por votos:<br/>entrar, permanecer o cambiar"]:::componente
        ajustes["SettingsRepository<br/>umbral de activación 1,5 m<br/>calibración a 1 m"]:::componente
        repo["BeaconRepository y Retrofit<br/>timeout 5 s, caché en memoria<br/>y respaldo local"]:::componente
        salida["Salida accesible<br/>TextToSpeech, vibración<br/>e historial"]:::componente
    end

    subgraph navegador["Navegador: React y Vite, dos builds separados"]
        landing["Landing y PWA<br/>dist/public, service worker"]:::componente
        panelweb["Panel<br/>dist/admin, solo bajo /ADMIN_PATH"]:::componente
    end

    subgraph servidor["Servidor Node.js: Express 5"]
        mw["Helmet y CSP, compresión,<br/>CORS cerrado, control de origen"]:::seguridad
        legacy["GET /beacons/:major/:minor<br/>contrato de la app, puerto 3000"]:::componente
        publica["/api/public<br/>contenido del sitio y contacto"]:::componente
        admin["/api/admin<br/>sesión JWT en cookie __Host-,<br/>CSRF, roles, límite de intentos"]:::seguridad
        render["Landing con datos iniciales<br/>en el HTML"]:::componente
        servicios["Servicios: bitácora, imágenes sin EXIF,<br/>respaldos y snapshot de beacons"]:::componente
    end

    subgraph datos["Datos"]
        prisma["Prisma 7"]:::componente
        pg[("PostgreSQL en Supabase<br/>beacons, users, news,<br/>sections, media, audit_logs")]:::externo
        snapshot[("beacons.snapshot.json<br/>y respaldos locales")]:::externo
        storage[("Supabase Storage<br/>o carpeta uploads")]:::externo
    end

    beacon -->|"anuncio BLE"| scanner
    scanner --> tracker
    tracker --> vm
    ajustes --> vm
    vm --> repo
    vm --> salida
    repo -->|"HTTP JSON"| mw
    landing -->|HTTPS| mw
    panelweb -->|HTTPS| mw
    mw --> legacy
    mw --> publica
    mw --> admin
    mw --> render
    admin --> servicios
    legacy --> prisma
    legacy -.->|"si la base no responde"| snapshot
    publica --> prisma
    admin --> prisma
    render --> prisma
    prisma --> pg
    servicios --> snapshot
    servicios --> storage
```

Imagen: [`arquitectura-estructurada.svg`](arquitectura-estructurada.svg) · [`arquitectura-estructurada.png`](arquitectura-estructurada.png)

## 3. Flujo de funcionamiento

Desde que el equipo registra un beacon en el panel hasta que la persona escucha dónde está, con las reglas que usa la app para engancharse a un beacon, mantenerlo o cambiar a otro, y los respaldos cuando falla la base de datos o la red.

```mermaid
flowchart TD
    classDef general fill:#FFE86D,stroke:#A28E26,color:#574900
    classDef decision fill:#9CE6FF,stroke:#2C97BB,color:#1C4657
    classDef terminator fill:#B3E65F,stroke:#6E9A24,color:#2F440B

    subgraph etapa_preparacion["1. Preparación en el panel"]
        p1(["El equipo registra un beacon:<br/>major, minor, título, descripción, ubicación"]):::terminator
        p2["Se guarda en PostgreSQL, queda en la bitácora<br/>y se actualiza el snapshot local"]:::general
    end

    subgraph etapa_deteccion["2. Detección en el teléfono"]
        d1(["La persona camina con la app abierta"]):::terminator
        d2["El beacon emite su anuncio BLE"]:::general
        d3{{"¿Es un paquete iBeacon?"}}:::decision
        d4["Se descarta"]:::general
        d5["Se guarda la muestra de RSSI<br/>y se recalcula la distancia"]:::general
    end

    subgraph etapa_decision["3. Decisión cada 250 ms"]
        e1{{"¿Hay un beacon enganchado?"}}:::decision
        e2{{"¿El más cercano está dentro<br/>del umbral (1,5 m) 2 veces seguidas?"}}:::decision
        e3{{"¿Sigue emitiendo y está<br/>a menos de máx(2,5 m, 3 × umbral)?"}}:::decision
        e4{{"¿Otro beacon está en su umbral y<br/>un 25 % más cerca, 2 veces seguidas?"}}:::decision
        e5["Se suelta el enganche"]:::general
        e6["Se mantiene el mensaje<br/>y se actualiza la distancia"]:::general
        e7["Se engancha el beacon"]:::general
    end

    subgraph etapa_consulta["4. Consulta al servidor"]
        s1{{"¿Ya está en la caché de la app?"}}:::decision
        s2["GET /beacons/major/minor"]:::general
        s3{{"¿Responde la base de datos?"}}:::decision
        s4["Se lee el snapshot local"]:::general
        s5{{"¿Existe el beacon?"}}:::decision
        s6["200: titulo, descripcion, ubicacion<br/>se guarda en la caché"]:::general
        s7["404, error o sin red:<br/>texto de respaldo de la app"]:::general
    end

    subgraph etapa_aviso["5. Aviso a la persona"]
        a1["Se muestra el lugar en pantalla"]:::general
        a2{{"¿Se anunció este beacon<br/>hace menos de 8 s?"}}:::decision
        a3(["Se lee en voz alta, vibra<br/>y se guarda en el historial"]):::terminator
        a4(["No se repite el anuncio"]):::terminator
    end

    p1 --> p2
    p2 -.->|"luego, en el edificio"| d1
    d1 --> d2 --> d3
    d3 -->|No| d4
    d3 -->|Sí| d5 --> e1
    e1 -->|No| e2
    e2 -->|No| d2
    e2 -->|Sí| e7
    e1 -->|Sí| e3
    e3 -->|No| e5 --> d2
    e3 -->|Sí| e4
    e4 -->|Sí, relevo| e7
    e4 -->|No| e6 --> d2
    e7 --> s1
    s1 -->|Sí| a1
    s1 -->|No| s2 --> s3
    s3 -->|Sí| s5
    s3 -->|No| s4 --> s5
    s5 -->|Sí| s6 --> a1
    s5 -->|No| s7 --> a1
    a1 --> a2
    a2 -->|No| a3
    a2 -->|Sí| a4
```

Imagen: [`flujo-funcionamiento.svg`](flujo-funcionamiento.svg) · [`flujo-funcionamiento.png`](flujo-funcionamiento.png)
