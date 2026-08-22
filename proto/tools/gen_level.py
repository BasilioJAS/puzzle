#!/usr/bin/env python3
"""
Genera la carpeta de un nivel: recorta la imagen en fichas PNG con transparencia
usando la curva de "oreja" elegida y escribe el level.json.

Ejemplos
--------
  python3 proto/tools/gen_level.py --image foto.png --id 06 --name "Mi nivel" \
      --cols 4 --rows 4 --time 180 --register

  # desde una receta exportada por el editor web:
  python3 proto/tools/gen_level.py --recipe level-06.recipe.json --image foto.png

Salida (dentro de --out, por defecto proto/public/levels):
  06/level.json
  06/image.png          imagen normalizada (mult. exacto de cols/rows)
  06/thumb.png
  06/pieces/p_<col>_<row>.png
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from earlib import CutResult, cut_polygons, hash_seed, load_ears  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, "..", "public", "levels"))
SUPERSAMPLE = 4  # antialias del recorte


def normalize_source(img: Image.Image, cols: int, rows: int) -> Image.Image:
    img = img.convert("RGBA")
    w = (img.width // cols) * cols
    h = (img.height // rows) * rows
    if w == 0 or h == 0:
        raise SystemExit("La imagen es demasiado chica para esa cantidad de fichas.")
    left = (img.width - w) // 2
    top = (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))


def render_pieces(src: Image.Image, res: CutResult, out_dir: str, stroke):
    os.makedirs(out_dir, exist_ok=True)
    pw, ph = int(round(res.piece_w)), int(round(res.piece_h))
    meta = []
    for p in res.pieces:
        # mascara en supersampling para que el borde quede suave
        mask = Image.new("L", (pw * SUPERSAMPLE, ph * SUPERSAMPLE), 0)
        d = ImageDraw.Draw(mask)
        poly = [((x - p.ox) * SUPERSAMPLE, (y - p.oy) * SUPERSAMPLE) for x, y in p.poly]
        d.polygon(poly, fill=255)
        mask = mask.resize((pw, ph), Image.LANCZOS)

        tile = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        tile.paste(src, (int(-p.ox), int(-p.oy)))
        tile.putalpha(mask)

        if stroke:
            line = Image.new("RGBA", (pw * SUPERSAMPLE, ph * SUPERSAMPLE), (0, 0, 0, 0))
            ImageDraw.Draw(line).line(poly + [poly[0]], fill=stroke, width=SUPERSAMPLE * 2)
            tile.alpha_composite(line.resize((pw, ph), Image.LANCZOS))

        name = "p_%d_%d.png" % (p.col, p.row)
        tile.save(os.path.join(out_dir, name))
        meta.append({"col": p.col, "row": p.row, "file": "pieces/" + name,
                     "ox": round(p.ox, 3), "oy": round(p.oy, 3)})
    return meta


def build(args) -> str:
    ears = load_ears(args.ears) if args.ears else load_ears()
    shape_id = args.ear or ears.get("default", "classic")
    if shape_id not in ears["shapes"]:
        raise SystemExit("Oreja '%s' no existe. Disponibles: %s" % (shape_id, list(ears["shapes"])))
    shape = ears["shapes"][shape_id]

    level_id = str(args.id)
    out_dir = os.path.join(args.out, level_id)
    os.makedirs(out_dir, exist_ok=True)

    src = normalize_source(Image.open(args.image), args.cols, args.rows)
    src.save(os.path.join(out_dir, "image.png"))
    thumb = src.copy()
    thumb.thumbnail((args.thumb, args.thumb), Image.LANCZOS)
    thumb.save(os.path.join(out_dir, "thumb.png"))

    seed = args.seed if args.seed is not None else hash_seed("%s:%dx%d" % (level_id, args.cols, args.rows))
    tab_ratio = args.tab_ratio if args.tab_ratio is not None else ears.get("tabRatio", 0.30)
    res = cut_polygons(args.cols, args.rows, src.width, src.height, shape,
                       tab_ratio, ears.get("flatten", 22), seed)
    pieces = render_pieces(src, res, os.path.join(out_dir, "pieces"), args.stroke)

    tutorial = None
    if args.tutorial:
        tutorial = {
            "enabled": True,
            "target": args.tutorial,          # "tip" | "time"
            "text": args.tutorial_text or "Tocá el botón que parpadea para usar el power-up.",
            "anim": args.tutorial_anim,
        }

    level = {
        "id": level_id,
        "name": args.name or ("Nivel " + level_id),
        "image": "image.png",
        "thumb": "thumb.png",
        "cols": args.cols,
        "rows": args.rows,
        "timeSec": args.time,
        "ear": shape_id,
        "tabRatio": tab_ratio,
        "seed": seed,
        "imageW": src.width,
        "imageH": src.height,
        "cellW": round(res.cell_w, 3),
        "cellH": round(res.cell_h, 3),
        "margin": res.margin,
        "pieceW": int(round(res.piece_w)),
        "pieceH": int(round(res.piece_h)),
        "powerups": {"tip": not args.no_tip, "time": not args.no_time},
        "tutorial": tutorial,
        "pieces": pieces,
    }
    with open(os.path.join(out_dir, "level.json"), "w", encoding="utf-8") as f:
        json.dump(level, f, indent=2, ensure_ascii=False)

    if args.register:
        register(args.out, level_id)

    print("OK nivel %s: %dx%d = %d fichas (%dx%dpx c/u) -> %s"
          % (level_id, args.cols, args.rows, args.cols * args.rows,
             level["pieceW"], level["pieceH"], out_dir))
    return out_dir


def register(levels_dir: str, level_id: str) -> None:
    """Agrega el nivel al index.json (orden del camino) si no estaba."""
    idx_path = os.path.join(levels_dir, "index.json")
    idx = {"levels": []}
    if os.path.exists(idx_path):
        with open(idx_path, encoding="utf-8") as f:
            idx = json.load(f)
    if level_id not in idx["levels"]:
        idx["levels"].append(level_id)
        idx["levels"].sort()
        with open(idx_path, "w", encoding="utf-8") as f:
            json.dump(idx, f, indent=2, ensure_ascii=False)
        print("   + registrado en " + idx_path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--recipe", help="JSON exportado por el editor de niveles (los flags lo pisan)")
    ap.add_argument("--image", help="imagen fuente")
    ap.add_argument("--id", help="id del nivel (nombre de la carpeta)")
    ap.add_argument("--name", help="nombre visible")
    ap.add_argument("--cols", type=int)
    ap.add_argument("--rows", type=int)
    ap.add_argument("--time", type=int, help="segundos")
    ap.add_argument("--ear", help="id de la oreja en ears.json")
    ap.add_argument("--ears", help="ruta a un ears.json alternativo")
    ap.add_argument("--tab-ratio", type=float, help="tamano de la oreja (0.30 por defecto)")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--stroke", default=None, help="color del contorno, ej '#00000055'")
    ap.add_argument("--thumb", type=int, default=256)
    ap.add_argument("--tutorial", choices=["tip", "time"], help="power-up sobre el que va el tutorial")
    ap.add_argument("--tutorial-text")
    ap.add_argument("--tutorial-anim", default="pulse", choices=["pulse", "shake", "bounce"])
    ap.add_argument("--no-tip", action="store_true")
    ap.add_argument("--no-time", action="store_true")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--register", action="store_true", help="agregar al index.json del camino")
    args = ap.parse_args()

    if args.recipe:
        with open(args.recipe, encoding="utf-8") as f:
            r = json.load(f)
        alias = {"timeSec": "time", "tabRatio": "tab_ratio"}
        for k, v in r.items():
            key = alias.get(k, k)
            if hasattr(args, key) and getattr(args, key) in (None, False):
                setattr(args, key, v)
        if isinstance(r.get("tutorial"), dict) and r["tutorial"].get("enabled"):
            args.tutorial = args.tutorial or r["tutorial"].get("target")
            args.tutorial_text = args.tutorial_text or r["tutorial"].get("text")

    missing = [k for k in ("image", "id", "cols", "rows", "time") if getattr(args, k) in (None, "")]
    if missing:
        ap.error("faltan argumentos: " + ", ".join("--" + m for m in missing))

    build(args)


if __name__ == "__main__":
    main()
