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

def edge_points(ax, ay, bx, by, direction, base_size=None, n_curve=20):
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
    
    if base_size is None:
        base_size = length

    # Vectores unitarios: tangente y normal
    tx, ty = dx / length, dy / length
    nx, ny = -ty, tx  # normal: 90° CCW respecto a la dirección de avance

    def pt(along, perp):
        """Convierte xy relativos (0 a 1) a absolutos en pantalla adaptando al tamaño base de la pestaña"""
        # La forma original asume un cuadrado de tamaño base_size. 
        # Si la arista es más larga, mantenemos el tamaño del enganche fijo en base_size,
        # y simplemente elongamos el tramo inicial y final (la parte recta) para llenar el hueco.
        
        # El enganche en el diseño bezier original arranca en > 0.347 y termina en < 0.653
        # offset_center_px será la posición real en X de la forma
        if along <= 0.347:
            # Tramo izquierdo estirado para cubrir la longitud real
            real_along = (along / 0.347) * (length / 2 - 0.153 * base_size)
        elif along < 0.653:
            # Tramo del enganche en sí (con su tamaño exacto base_size)
            real_along = length / 2 + (along - 0.5) * base_size
        else:
            # Tramo derecho estirado para cubrir el resto
            start_px = length / 2 + 0.153 * base_size
            real_along = start_px + ((along - 0.653) / (1.0 - 0.653)) * (length - start_px)

        real_perp = perp * base_size * direction
        return [ax + tx * real_along + nx * real_perp, ay + ty * real_along + ny * real_perp]

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

def piece_polygon(col, row, cols, rows, cell_w, cell_h, tabs, margin=0):
    """
    Construye el polígono de la pieza en (col, row).

    tabs[row][col] = (top, right, bottom, left)
      +1 = pestaña saliente, -1 = ranura entrante, 0 = borde plano (borde externo)
    """
    x0 = col * cell_w + margin
    y0 = row * cell_h + margin
    x1 = x0 + cell_w
    y1 = y0 + cell_h

    top, right, bottom, left = tabs[row][col]

    pts = []

    base_size = min(cell_w, cell_h)

    # Top: izquierda → derecha (pestaña sube = dirección -1 en coordenadas de pantalla)
    # La normal "izquierda" del vector (x0,y0)→(x1,y0) apunta hacia ARRIBA (y negativo)
    # Por convención usamos: +1 = pestaña hacia arriba (y negativo) en borde top
    pts += edge_points(x0, y0, x1, y0,  -top, base_size)

    # Right: arriba → abajo; normal apunta a la derecha
    pts += edge_points(x1, y0, x1, y1,  right, base_size)[1:]

    # Bottom: derecha → izquierda; normal apunta hacia abajo
    pts += edge_points(x1, y1, x0, y1,  bottom, base_size)[1:]

    # Left: abajo → arriba; normal apunta a la izquierda
    pts += edge_points(x0, y1, x0, y0,  -left, base_size)[1:]

    return [(round(p[0]), round(p[1])) for p in pts]


# ── Main generation ────────────────────────────────────────────────────────────

def generate_masks(cols: int, rows: int, cell_w: float, cell_h: float, output_dir: str, seed: int | None):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    rng = random.Random(seed)

    img_w = round(cols * cell_w)
    img_h = round(rows * cell_h)

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
        top    = 0 if r == 0          else h_tabs[(r-1, c)]  # mismo valor que el bottom del de arriba
        bottom = 0 if r == rows - 1   else h_tabs[(r,   c)]
        left   = 0 if c == 0          else v_tabs[(r, c-1)]  # mismo valor que el right del de la izq
        right  = 0 if c == cols - 1   else v_tabs[(r,   c)]
        return (top, right, bottom, left)

    tabs = [[get_tabs(r, c) for c in range(cols)] for r in range(rows)]

    print(f"Generando {cols}×{rows} = {cols*rows} piezas  ({img_w}×{img_h} px por máscara)")
    print(f"Destino: {out.resolve()}\n")

    for r in range(rows):
        for c in range(cols):
            poly = piece_polygon(c, r, cols, rows, cell_w, cell_h, tabs)

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
    size_group.add_argument(
        "--crop", type=int, nargs=4, metavar=("X", "Y", "W", "H"),
        help="Región de crop: x y w h. Genera máscaras del tamaño del crop."
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

    if args.crop:
        _cx, _cy, cw, ch = args.crop
        cell_w = cw / args.cols
        cell_h = ch / args.rows
    elif args.image_size:
        w, h = args.image_size
        cell_w = w / args.cols
        cell_h = h / args.rows
    else:
        cell_w = args.cell_size
        cell_h = args.cell_size

    if min(cell_w, cell_h) < 64:
        print(f"Advertencia: cell size ({cell_w:.1f}x{cell_h:.1f}) es muy chico; las pestañas pueden quedar mal.")

    generate_masks(args.cols, args.rows, cell_w, cell_h, args.output, args.seed)


if __name__ == "__main__":
    main()
