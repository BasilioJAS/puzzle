#!/usr/bin/env python3
"""
Empaqueta el juego en un único HTML autocontenido (sin pedidos de red), para
poder abrirlo desde cualquier lado sin servidor.

  npx vite build --config proto/vite.artifact.config.ts
  python3 proto/tools/bundle_artifact.py

Las fichas van tal cual, PNG con transparencia. La imagen de fondo del tablero
(que sólo se usa como guía tenue) se re-comprime a JPEG para que el archivo entre
en el límite de tamaño.
"""
from __future__ import annotations

import base64
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.normpath(os.path.join(HERE, "..", "..", "dist-artifact"))
GHOST_MAX = 384
GHOST_QUALITY = 68

# El HTML final se sirve sin <head> propio: fijamos el viewport desde JS para
# que en el teléfono no caiga al ancho de escritorio de 980px.
HEAD_SHIM = """
(function () {
  var m = document.querySelector('meta[name=viewport]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
  m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
})();
"""

SHIM = """
(function () {
  var E = window.__EMBED;
  function key(u) {
    u = String(u);
    if (u.slice(0, 2) === './') u = u.slice(2);
    var q = u.indexOf('?');
    if (q >= 0) u = u.slice(0, q);
    return u;
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (u, o) {
    var k = key(u);
    if (Object.prototype.hasOwnProperty.call(E, k)) {
      return Promise.resolve(new Response(E[k], {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    return realFetch(u, o);
  };
  var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: true,
    get: function () { return d.get.call(this); },
    set: function (v) {
      var k = key(v);
      d.set.call(this, Object.prototype.hasOwnProperty.call(E, k) ? E[k] : v);
    }
  });
})();
"""


def ascii_escape(js: str) -> str:
    """Escapa los caracteres no-ASCII a \\uXXXX.

    El archivo va sin <meta charset> propio, así que si el visor lo interpreta
    como latin-1 los acentos se romperían. En este bundle todos los no-ASCII
    caen dentro de literales de string, con lo cual escaparlos es seguro.
    """
    out = []
    for ch in js:
        if ord(ch) > 127:
            b = ch.encode("utf-16-be")
            for i in range(0, len(b), 2):
                out.append("\\u%02x%02x" % (b[i], b[i + 1]))
        else:
            out.append(ch)
    return "".join(out)


def data_uri(path: str, mime: str) -> str:
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def build() -> str:
    if not os.path.isdir(DIST):
        sys.exit("Falta dist-artifact/. Corré primero:\n"
                 "  npx vite build --config proto/vite.artifact.config.ts")

    embed: dict[str, str] = {}

    for name in ("game.config.json", "ears.json"):
        with open(os.path.join(DIST, "config", name), encoding="utf-8") as f:
            embed["config/" + name] = f.read()

    levels_dir = os.path.join(DIST, "levels")
    with open(os.path.join(levels_dir, "index.json"), encoding="utf-8") as f:
        index = json.load(f)
    embed["levels/index.json"] = json.dumps(index)

    for lid in index["levels"]:
        d = os.path.join(levels_dir, lid)
        with open(os.path.join(d, "level.json"), encoding="utf-8") as f:
            level = json.load(f)

        # guía del tablero: JPEG chico, no necesita alfa
        ghost = Image.open(os.path.join(d, level["image"])).convert("RGB")
        ghost.thumbnail((GHOST_MAX, GHOST_MAX), Image.LANCZOS)
        tmp = os.path.join(d, "_ghost.jpg")
        ghost.save(tmp, quality=GHOST_QUALITY, optimize=True)
        level["image"] = "ghost.jpg"
        embed["levels/%s/ghost.jpg" % lid] = data_uri(tmp, "image/jpeg")
        os.remove(tmp)

        # fichas: PNG con transparencia, sin tocar
        for p in level["pieces"]:
            embed["levels/%s/%s" % (lid, p["file"])] = data_uri(os.path.join(d, p["file"]), "image/png")

        embed["levels/%s/level.json" % lid] = json.dumps(level)

    with open(os.path.join(DIST, "app.css"), encoding="utf-8") as f:
        css = f.read()
    with open(os.path.join(DIST, "app.js"), encoding="utf-8") as f:
        js = f.read()

    html = "\n".join([
        "<title>Puzzle Proto</title>",
        "<script>%s</script>" % HEAD_SHIM,
        "<style>%s</style>" % css,
        # los editores viven en páginas aparte que no entran en este archivo único
        "<style>.links{display:none !important}</style>",
        "<script>window.__EMBED=%s;</script>" % json.dumps(embed),
        "<script>%s</script>" % SHIM,
        '<div id="app"></div>',
        '<script type="module">%s</script>' % ascii_escape(js),
        "",
    ])

    out = os.path.join(DIST, "puzzle-proto.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("OK %s  (%.2f MB, %d archivos embebidos)"
          % (out, os.path.getsize(out) / 1e6, len(embed)))
    return out


if __name__ == "__main__":
    build()
