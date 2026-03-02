#!/usr/bin/env python3
"""
puzzle_mask_generator.py — Genera máscaras PNG de piezas de rompecabezas.

Uso:
    python puzzle_mask_generator.py <cols> <rows> [opciones]

Ejemplos:
    python puzzle_mask_generator.py 3 3
    python puzzle_mask_generator.py 4 4 --cell-size 200 --output masks/
    python puzzle_mask_generator.py 5 5 --image-size 1024 1024 --output masks/

Las máscaras se nombran: piece_<row>_<col>.png
Son del mismo tamaño que la imagen fuente (cols*cell_size × rows*cell_size).
Blanco = área de la pieza, negro = transparente.

Dependencias:
    pip install Pillow numpy
"""

import argparse
import math
import random
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    import sys
    print("ERROR: Faltan dependencias. Instalalas con:")
    print("  pip install Pillow numpy")
    sys.exit(1)


# ── Bezier helpers ─────────────────────────────────────────────────────────────

def cubic_bezier(p0, p1, p2, p3, n=25):
    """Retorna n puntos a lo largo de una curva bezier cúbica."""
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = (np.array(x) for x in (p0, p1, p2, p3))
    return ((1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3)


# ── Edge shape ─────────────────────────────────────────────────────────────────

def edge_points(ax, ay, bx, by, direction, n_curve=20):
    """
    Genera puntos a lo largo de un borde de rompecabezas de (ax,ay) a (bx,by).

    direction:
      +1  → la pestaña sobresale hacia la "izquierda" del vector AB
      -1  → la ranura se hunde hacia la "derecha"
       0  → borde recto (borde del marco)
    """
    if direction == 0:
        return [(ax, ay), (bx, by)]

    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)

    # Vectores unitarios: tangente y normal
    tx, ty = dx / length, dy / length
    nx, ny = -ty, tx  # normal: 90° CCW respecto a la dirección de avance

    def pt(along, perp):
        """Convierte xy relativos (0 a 1) a absolutos en pantalla"""
        a = length * along
        p = length * perp * direction
        return [ax + tx*a + nx*p, ay + ty*a + ny*p]

    pts = []
    def add_curve(p0, p1, p2, p3):
        # Genera los puntos de la curva y descarta el primero (para no duplicar)
        curve = cubic_bezier(pt(*p0), pt(*p1), pt(*p2), pt(*p3), n_curve)[1:]
        pts.extend(curve.tolist())

    pts.append(pt(0.00, 0.00))

    # Control points visualmente generados (x_a_lo_largo, y_perpendicular)
    add_curve((0.000, 0.000), (0.140, 0.000), (0.174, -0.001), (0.347, -0.001))
    add_curve((0.347, -0.001), (0.394, 0.011), (0.407, 0.032), (0.360, 0.069))
    add_curve((0.360, 0.069), (0.280, 0.097), (0.335, 0.300), (0.500, 0.295))
    add_curve((0.500, 0.295), (0.665, 0.300), (0.720, 0.097), (0.640, 0.069))
    add_curve((0.640, 0.069), (0.593, 0.032), (0.606, 0.011), (0.653, -0.001))
    add_curve((0.653, -0.001), (0.826, -0.001), (0.860, 0.000), (1.000, 0.000))

    return pts


# ── Piece outline ──────────────────────────────────────────────────────────────

def piece_polygon(col, row, cols, rows, cell, tabs, margin=0):
    """
    Construye el polígono de la pieza en (col, row).

    tabs[row][col] = (top, right, bottom, left)
      +1 = pestaña saliente, -1 = ranura entrante, 0 = borde plano (borde externo)
    """
    x0 = col * cell + margin
    y0 = row * cell + margin
    x1 = x0 + cell
    y1 = y0 + cell

    top, right, bottom, left = tabs[row][col]

    pts = []

    # Top: izquierda → derecha (pestaña sube = dirección -1 en coordenadas de pantalla)
    # La normal "izquierda" del vector (x0,y0)→(x1,y0) apunta hacia ARRIBA (y negativo)
    # Por convención usamos: +1 = pestaña hacia arriba (y negativo) en borde top
    pts += edge_points(x0, y0, x1, y0,  -top)

    # Right: arriba → abajo; normal apunta a la derecha
    pts += edge_points(x1, y0, x1, y1,  right)[1:]

    # Bottom: derecha → izquierda; normal apunta hacia abajo
    pts += edge_points(x1, y1, x0, y1,  bottom)[1:]

    # Left: abajo → arriba; normal apunta a la izquierda
    pts += edge_points(x0, y1, x0, y0,  -left)[1:]

    return [(round(p[0]), round(p[1])) for p in pts]


# ── Main generation ────────────────────────────────────────────────────────────

def generate_masks(cols: int, rows: int, cell_size: int, output_dir: str, seed: int | None):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    rng = random.Random(seed)

    img_w = cols * cell_size
    img_h = rows * cell_size

    # Generar direcciones de pestañas para cada borde compartido
    # tabs[r][c] = (top, right, bottom, left)
    # +1 = pestaña hacia afuera, -1 = ranura
    h_tabs = {}  # bordes horizontales compartidos: h_tabs[(r,c)] = dirección del borde BOTTOM de fila r
    v_tabs = {}  # bordes verticales compartidos:   v_tabs[(r,c)] = dirección del borde RIGHT de col c

    for r in range(rows - 1):
        for c in range(cols):
            h_tabs[(r, c)] = rng.choice([-1, 1])  # borde entre fila r y r+1

    for r in range(rows):
        for c in range(cols - 1):
            v_tabs[(r, c)] = rng.choice([-1, 1])  # borde entre col c y c+1

    def get_tabs(r, c):
        top    = 0 if r == 0          else -h_tabs[(r-1, c)]  # inverso del bottom del de arriba
        bottom = 0 if r == rows - 1   else  h_tabs[(r,   c)]
        left   = 0 if c == 0          else -v_tabs[(r, c-1)]  # inverso del right del de la izq
        right  = 0 if c == cols - 1   else  v_tabs[(r,   c)]
        return (top, right, bottom, left)

    tabs = [[get_tabs(r, c) for c in range(cols)] for r in range(rows)]

    print(f"Generando {cols}×{rows} = {cols*rows} piezas  ({img_w}×{img_h} px por máscara)")
    print(f"Destino: {out.resolve()}\n")

    for r in range(rows):
        for c in range(cols):
            poly = piece_polygon(c, r, cols, rows, cell_size, tabs)

            # Lienzo del tamaño de la imagen fuente, fondo negro
            mask_img = Image.new("L", (img_w, img_h), 0)
            draw = ImageDraw.Draw(mask_img)
            draw.polygon(poly, fill=255)

            # Suavizado leve de los bordes
            mask_img = mask_img.filter(ImageFilter.SMOOTH)

            fname = out / f"piece_{r}_{c}.png"
            mask_img.save(fname, "PNG")
            print(f"  ✓ piece_{r}_{c}.png   ({tabs[r][c]})")

    print(f"\n✅ Listo! {cols*rows} máscaras en: {out.resolve()}")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Genera máscaras de piezas de rompecabezas con formas interlocked."
    )
    parser.add_argument("cols", type=int, help="Número de columnas")
    parser.add_argument("rows", type=int, help="Número de filas")

    size_group = parser.add_mutually_exclusive_group()
    size_group.add_argument(
        "--cell-size", type=int, default=256, metavar="PX",
        help="Tamaño de celda en píxeles (default: 256)"
    )
    size_group.add_argument(
        "--image-size", type=int, nargs=2, metavar=("W", "H"),
        help="Tamaño total de la imagen fuente (calcula cell-size automáticamente)"
    )

    parser.add_argument(
        "--output", "-o", default="masks_output", metavar="DIR",
        help="Carpeta de salida (default: masks_output)"
    )
    parser.add_argument(
        "--seed", type=int, default=None,
        help="Semilla aleatoria para reproducibilidad"
    )

    args = parser.parse_args()

    if args.image_size:
        w, h = args.image_size
        cell_size = min(w // args.cols, h // args.rows)
    else:
        cell_size = args.cell_size

    if cell_size < 64:
        print(f"Advertencia: cell_size={cell_size} es muy chico; las pestañas pueden quedar mal.")

    generate_masks(args.cols, args.rows, cell_size, args.output, args.seed)


if __name__ == "__main__":
    main()
