# Puzzle Proto

Prototipo de rompecabezas para móvil/browser. HTML + TypeScript, sin engine, sin
dependencias en runtime. Vive en `proto/` y **no toca el juego que ya estaba en la raíz**.

```
proto/
├── index.html            juego
├── editor.html           editor de niveles
├── ears.html             editor de orejas (bezier)
├── vite.config.ts
├── public/
│   ├── config/
│   │   ├── game.config.json   ⭐ colores, medidas, textos, iconos, sonidos, power-ups, precios
│   │   └── ears.json          ⭐ biblioteca de orejas (curvas bezier)
│   ├── levels/
│   │   ├── index.json         orden del camino
│   │   └── 01/                una carpeta por nivel
│   │       ├── level.json     config del nivel
│   │       ├── image.png      imagen normalizada
│   │       ├── thumb.png
│   │       └── pieces/p_<col>_<fila>.png    fichas PNG con transparencia
│   └── samples/               imágenes de ejemplo para el editor
├── src/
│   ├── config/           carga del config + acceso a textos/iconos/medidas
│   ├── core/             audio, vibración, guardado, router, helpers de DOM
│   ├── puzzle/           geometría de las orejas + corte de fichas
│   ├── screens/          splash, menú, mapa, juego, tienda, acerca de
│   ├── editor/           editor de niveles + escritor de zip
│   └── ears/             editor de orejas
└── tools/
    ├── earlib.py         geometría de orejas (espejo exacto del TS)
    ├── gen_level.py      genera la carpeta del nivel y las fichas PNG
    └── requirements.txt
```

## Correr

```bash
npm install
npm run proto:dev        # http://localhost:5174 (con --host: también por IP de la red)
npm run proto:build      # deja el build en dist-proto/
npm run proto:preview
```

## Probar desde el teléfono

Tres caminos, de menos a más independiente de la compu:

1. **GitHub Pages** — cada push de esta rama publica el prototipo en
   <https://basiliojas.github.io/puzzle/proto/> (workflow `.github/workflows/proto.yml`).
   Entrás desde el teléfono y listo, no hace falta la compu para nada.
   Los editores están en `.../proto/editor.html` y `.../proto/ears.html`.
2. **Misma red WiFi** — `npm run proto:dev` levanta el server con `--host`; abrí en el
   teléfono `http://<IP-de-la-compu>:5174`.
3. **Todo desde el teléfono** — el editor de niveles corta las fichas en el navegador y
   con *"Probar en este dispositivo"* guarda el nivel en el teléfono; aparece al final del
   camino y lo jugás al toque. No necesita ni compu ni Python.

## Cómo funciona el juego

- **Splash** → tap → **menú** (Jugar / Tienda / Acerca de + toggles de música, sonido y
  vibración) → **mapa** (camino serpenteante; cada nivel se desbloquea al pasar el anterior)
  → **juego**.
- La dificultad sale de **dos variables**: cantidad de fichas y tiempo.
- Estrellas según el tiempo que sobra (umbrales en `gameplay.starThresholds`).
- **Power-ups**: `tip` (acomoda una ficha) y `time` (suma segundos). Se compran en la tienda.
- **Tutorial**: si el nivel lo tiene, aparece un popup, el botón indicado se anima y
  **queda todo bloqueado menos ese botón**; si tocás cualquier otra cosa suena el sonido de
  bloqueado. Se muestra una sola vez por nivel (queda guardado).
- **Zoom y arrastre del tablero**: pellizco para acercar, un dedo sobre el tablero para
  moverlo, doble tap para acercar/volver a ver todo, y un botón que vuelve al encuadre
  original. En la compu también anda con la rueda del mouse. Los límites salen de
  `gameplay.minZoom` / `maxZoom` / `doubleTapZoom`.
- **Filtros de la bandeja**: por forma (bordes / interior, sale de la posición de la
  ficha en la grilla) y por color dominante. El color se calcula al cargar cada ficha,
  en la misma pasada de píxeles que arma la máscara del hit-test, así que anda también
  con los niveles hechos en el editor. Los baldes de color, sus rangos de tono y los
  umbrales están en `filters` del config; sólo se muestran los colores que el nivel
  realmente tiene (`minPiecesPerColor`).
- El tablero arranca **vacío**: no se muestra la imagen a completar de fondo. Se puede
  volver a activar con `gameplay.showGhostImage` (y la grilla con `gameplay.showGrid`).
- Se adapta a la pantalla: en vertical la bandeja va abajo, en apaisado a la derecha.

## Configuración

**Todo lo editable está en `public/config/game.config.json`**: colores, medidas (`metrics`),
textos (`text.es`), iconos (`icons`, son emoji: cambiás el emoji y cambia el ícono en todos
lados), sonidos (`audio.sfx`, sintetizados con WebAudio: onda, frecuencia, duración),
patrones de vibración, power-ups, precios de la tienda y recompensas.

Cada nivel tiene su `level.json` en su carpeta, con imagen, cols/filas, tiempo, oreja,
power-ups habilitados y tutorial.

## Tool de fichas (Python)

Genera la carpeta del nivel con las fichas PNG con transparencia:

```bash
pip install -r proto/tools/requirements.txt

python3 proto/tools/gen_level.py \
    --image mi_foto.png --id 06 --name "Mi nivel" \
    --cols 4 --rows 4 --time 180 \
    --ear classic --tutorial tip --register
```

- `--register` agrega el id a `public/levels/index.json` (el orden del camino).
- `--ear` elige la oreja de `public/config/ears.json`; `--ears otro.json` usa otra biblioteca
  (por ejemplo la que te bajás del editor de orejas).
- `--recipe nivel-06.recipe.json` toma los parámetros de una receta exportada por el editor web.
- `--stroke '#00000055'` le dibuja un contorno a cada ficha.

La imagen se recorta al múltiplo exacto de `cols`×`rows`, así todas las celdas son enteras.
Las fichas se guardan con un margen uniforme para que entren las orejas, y el `level.json`
anota el `ox/oy` de cada una: reensamblarlas en esas posiciones reconstruye la imagen exacta.

## Editor de niveles (`editor.html`)

Elegís imagen (del dispositivo o de ejemplo), id, nombre, cantidad de fichas, tiempo, oreja,
tamaño del diente, qué power-ups habilitar y el tutorial. Después:

- **Generar fichas** — las corta en el navegador (mismo algoritmo que la tool de Python).
- **Probar en este dispositivo** — guarda el nivel en el teléfono y lo suma al camino.
- **Descargar .zip** — la carpeta del nivel lista para descomprimir en `public/levels/`.
- **Descargar receta** — el JSON para pasarle a `gen_level.py --recipe`.
- Abajo te muestra el **comando de la tool** ya armado.

## Editor de orejas (`ears.html`)

La oreja es una curva bezier sobre una arista unitaria de `(0,0)` a `(1,0)`; la `Y` es cuánto
sobresale el diente. Arrastrás los puntos, agregás o sacás tramos, y ves en vivo cómo quedan
las fichas. Guardás la oreja en el dispositivo (queda disponible en el editor de niveles) o
te bajás el `ears.json` para reemplazar el de `public/config/` y usarlo también desde Python.

Por ahora viene una sola oreja (`classic`). Agregás las que quieras con este editor: cada
nivel elige la suya con el campo `ear` de su `level.json`.

> La geometría está implementada dos veces (`src/puzzle/ears.ts` y `tools/earlib.py`) con el
> mismo RNG y el mismo recorrido de aristas, así que el corte del navegador y el de Python
> dan exactamente la misma forma.

## Lo que falta (es un prototipo)

- Las fichas colocadas quedan fijas: no se pueden volver a levantar.
- No hay rotación de fichas ni encastre entre fichas sueltas.
- Música y efectos son sintetizados, no hay archivos de audio.
- Un solo idioma (`text.es`), aunque la estructura ya soporta más.

## Build de un solo archivo (sin servidor)

```bash
npm run proto:artifact     # deja dist-artifact/puzzle-proto.html
```

Empaqueta **solo el juego** en un único HTML autocontenido (~10 MB): config, niveles
y fichas van embebidos como data URIs, así que no hace ni un pedido de red. Sirve para
abrirlo desde cualquier lado sin servidor, o para publicarlo como página suelta.

Las fichas van tal cual, PNG con transparencia; la imagen guía del tablero se
re-comprime a JPEG (no necesita alfa) para que el archivo no se vaya de tamaño.
Los editores no entran en este build: viven en sus propias páginas.
