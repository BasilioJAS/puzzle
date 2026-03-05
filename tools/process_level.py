#!/usr/bin/env python3
"""
process_level.py — Procesa un nivel completo: genera máscaras y corta piezas.

Lee levels_curve.json para obtener cols/rows del nivel.
Lee puzzle_crops.json (si existe) para obtener datos de crop.
Genera máscaras en tools/assets/masks/{id}/
Corta piezas en public/assets/levels/{id}/

Uso:
    python tools/process_level.py <level_id>
"""

import sys
import json
import subprocess
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Uso: python tools/process_level.py <level_id>")
        sys.exit(1)

    level_id = int(sys.argv[1])

    # Resolve project root (parent of tools/)
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    # ── Load levels_curve.json ────────────────────────────────────────────────
    levels_file = project_root / "public" / "assets" / "levels_curve.json"
    if not levels_file.exists():
        print(f"ERROR: No se encontró {levels_file}")
        sys.exit(1)

    with open(levels_file, "r", encoding="utf-8") as f:
        levels = json.load(f)

    level_data = None
    for lvl in levels:
        if lvl["id"] == level_id:
            level_data = lvl
            break

    if not level_data:
        print(f"ERROR: Nivel {level_id} no encontrado en levels_curve.json")
        sys.exit(1)

    cols = level_data["cols"]
    rows = level_data["rows"]
    print(f"Nivel {level_id}: {cols}x{rows} ({cols * rows} piezas)")

    # ── Load puzzle_crops.json (optional) ─────────────────────────────────────
    crops_file = script_dir / "assets" / "puzzle_crops.json"
    crop_data = None
    if crops_file.exists():
        with open(crops_file, "r", encoding="utf-8") as f:
            all_crops = json.load(f)
        crop_data = all_crops.get(str(level_id))

    # ── Paths ─────────────────────────────────────────────────────────────────
    img_file = script_dir / "assets" / "puzzlesImg" / f"{level_id}.png"
    masks_dir = script_dir / "assets" / "masks" / str(level_id)
    output_dir = project_root / "public" / "assets" / "levels" / str(level_id)

    if not img_file.exists():
        print(f"ERROR: Imagen no encontrada: {img_file}")
        sys.exit(1)

    # ── Determinar Aspect Ratio y Orientación ─────────────────────────────────
    is_landscape = True
    crop_w, crop_h = 0, 0
    if crop_data:
        crop_w = crop_data["w"]
        crop_h = crop_data["h"]
        is_landscape = crop_w >= crop_h
    else:
        from PIL import Image
        img = Image.open(img_file)
        w, h = img.size
        crop_w, crop_h = w, h
        is_landscape = w >= h

    if (cols >= rows) != is_landscape and cols != rows:
        print(f"  [+] Rotando grilla {cols}x{rows} -> {rows}x{cols} para coincidir con aspecto de imagen")
        cols, rows = rows, cols

    cell_w = crop_w / cols
    cell_h = crop_h / rows

    # ── Step 1: Generar máscaras ──────────────────────────────────────────────
    print(f"\n── Generando máscaras en {masks_dir} ──")
    mask_cmd = [
        sys.executable,
        str(script_dir / "puzzle_mask_generator.py"),
        str(cols), str(rows),
        "--output", str(masks_dir),
        "--seed", str(level_id),
    ]

    if crop_data:
        mask_cmd.extend(["--crop",
            str(crop_data["x"]), str(crop_data["y"]),
            str(crop_data["w"]), str(crop_data["h"])
        ])
    else:
        mask_cmd.extend(["--image-size", str(w), str(h)])

    result = subprocess.run(mask_cmd)
    if result.returncode != 0:
        print("ERROR: Falló la generación de máscaras")
        sys.exit(1)

    # ── Step 2: Cortar piezas ─────────────────────────────────────────────────
    print(f"\n── Cortando piezas en {output_dir} ──")
    cut_cmd = [
        sys.executable,
        str(script_dir / "puzzle_piece_cutter.py"),
        str(img_file),
        str(masks_dir),
        str(output_dir),
    ]

    if crop_data:
        cut_cmd.extend(["--crop",
            str(crop_data["x"]), str(crop_data["y"]),
            str(crop_data["w"]), str(crop_data["h"])
        ])

    result = subprocess.run(cut_cmd)
    if result.returncode != 0:
        print("ERROR: Falló el corte de piezas")
        sys.exit(1)

    # ── Step 3: Exportar metadata ─────────────────────────────────────────────
    meta_json = {
        "id": level_id,
        "cols": cols,
        "rows": rows,
        "cellW_px": cell_w,
        "cellH_px": cell_h
    }
    with open(output_dir / "level_data.json", "w", encoding="utf-8") as f:
        json.dump(meta_json, f, indent=4)
        print(f"  [+] Guardado metadata en {output_dir / 'level_data.json'}")

    print(f"\n✅ Nivel {level_id} procesado correctamente!")


if __name__ == "__main__":
    main()
