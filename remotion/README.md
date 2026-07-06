# Remotion — MotorHub

Proyecto de [Remotion](https://www.remotion.dev) para crear y editar vídeos por código (React + TypeScript), pensado para generar piezas de vídeo (intros, promos, etc.) para MotorHub.

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
cd remotion
npm install
```

## Uso

**Editor interactivo (Remotion Studio):**

```bash
npm start
```

Abre el editor en el navegador, donde se puede previsualizar y ajustar la composición `MotorIntro` fotograma a fotograma.

**Renderizar el vídeo final (MP4):**

```bash
npm run build
```

El resultado se guarda en `remotion/out/motor-intro.mp4`.

## Estructura

```
remotion/
├── src/
│   ├── index.ts          # Punto de entrada, registra la raíz
│   ├── Root.tsx           # Declara las composiciones (vídeos) disponibles
│   └── MotorIntro/
│       └── MotorIntro.tsx # Composición de ejemplo: intro animado de MotorHub
├── remotion.config.ts     # Configuración del CLI de Remotion
└── package.json
```

Para crear un nuevo vídeo, agregá un componente en `src/` y registralo como una nueva `<Composition />` en `Root.tsx`.

## Nota sobre el navegador headless

Remotion usa una copia de Chromium para renderizar. En entornos con acceso a internet restringido (por ejemplo, algunos entornos en la nube), puede ser necesario apuntar a un binario de Chromium ya instalado en vez de dejar que Remotion descargue el suyo:

```bash
REMOTION_BROWSER_EXECUTABLE=/ruta/a/chromium npm run build
```

En una computadora normal con acceso a internet esto no es necesario: Remotion descarga automáticamente su propia versión de Chrome Headless Shell la primera vez que se ejecuta.
