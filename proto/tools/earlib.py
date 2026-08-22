"""
Geometría de orejas del rompecabezas — versión Python.

Es el espejo exacto de proto/src/puzzle/ears.ts: mismo formato de curva,
mismo RNG (mulberry32) y mismo recorrido de aristas, así que las fichas
generadas por la tool son idénticas a las que previsualiza el editor web.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from typing import Dict, List, Tuple

Pt = Tuple[float, float]

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_EARS = os.path.normpath(os.path.join(HERE, "..", "public", "config", "ears.json"))


def load_ears(path: str = DEFAULT_EARS) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def flatten_ear(shape: dict, steps: int) -> List[Pt]:
    out: List[Pt] = [(0.0, 0.0)]
    px = py = 0.0
    for c1x, c1y, c2x, c2y, ex, ey in shape["segments"]:
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
            out.append((a * px + b * c1x + c * c2x + d * ex,
                        a * py + b * c1y + c * c2y + d * ey))
        px, py = ex, ey
    return out


def ear_max_abs_y(shape: dict) -> float:
    m = 0.0
    for s in shape["segments"]:
        m = max(m, abs(s[1]), abs(s[3]), abs(s[5]))
    return m


def rng(seed: int):
    """mulberry32, bit a bit igual al de JS (aritmética de 32 bits sin signo)."""
    state = seed & 0xFFFFFFFF

    def imul(x: int, y: int) -> int:
        return (x * y) & 0xFFFFFFFF

    def nxt() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        a = state
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return nxt


def hash_seed(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h & 0xFFFFFFFF


@dataclass
class PieceCut:
    col: int
    row: int
    ox: float
    oy: float
    poly: List[Pt]


@dataclass
class CutResult:
    cell_w: float
    cell_h: float
    margin: int
    piece_w: float
    piece_h: float
    pieces: List[PieceCut]


def cut_polygons(cols: int, rows: int, img_w: int, img_h: int, shape: dict,
                 tab_ratio: float, flatten: int, seed: int) -> CutResult:
    cell_w = img_w / cols
    cell_h = img_h / rows
    # la oreja escala con el largo de cada arista, asi mantiene su proporcion
    max_y = ear_max_abs_y(shape) * tab_ratio
    margin = math.ceil(max_y * max(cell_w, cell_h)) + 2
    base = flatten_ear(shape, flatten)
    rand = rng(seed)

    h_sign = [[-1 if rand() < 0.5 else 1 for _ in range(cols)] for _ in range(rows + 1)]
    v_sign = [[-1 if rand() < 0.5 else 1 for _ in range(cols + 1)] for _ in range(rows)]

    def edge_pts(ax, ay, bx, by, sign) -> List[Pt]:
        dx, dy = bx - ax, by - ay
        ln = math.hypot(dx, dy)
        ux, uy = dx / ln, dy / ln
        nx, ny = -uy, ux
        tab = tab_ratio * ln
        return [(ax + ux * px * ln + nx * py * tab * sign,
                 ay + uy * px * ln + ny * py * tab * sign) for px, py in base]

    def straight(ax, ay, bx, by) -> List[Pt]:
        return [(ax, ay), (bx, by)]

    pieces: List[PieceCut] = []
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * cell_w, r * cell_h
            x1, y1 = x0 + cell_w, y0 + cell_h

            top = straight(x0, y0, x1, y0) if r == 0 else edge_pts(x0, y0, x1, y0, h_sign[r][c])
            right = straight(x1, y0, x1, y1) if c == cols - 1 else edge_pts(x1, y0, x1, y1, v_sign[r][c + 1])
            bottom = straight(x1, y1, x0, y1) if r == rows - 1 else list(reversed(edge_pts(x0, y1, x1, y1, h_sign[r + 1][c])))
            left = straight(x0, y1, x0, y0) if c == 0 else list(reversed(edge_pts(x0, y0, x0, y1, v_sign[r][c])))

            poly: List[Pt] = []
            poly.extend(top)
            poly.extend(right[1:])
            poly.extend(bottom[1:])
            poly.extend(left[1:])
            poly.pop()

            pieces.append(PieceCut(c, r, x0 - margin, y0 - margin, poly))

    return CutResult(cell_w, cell_h, margin, cell_w + margin * 2, cell_h + margin * 2, pieces)
