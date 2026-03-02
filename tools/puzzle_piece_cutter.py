#!/usr/bin/env python3
"""
puzzle_piece_cutter.py — Genera PNGs transparentes de piezas de rompecabezas
combinando una imagen fuente con una carpeta de máscaras.

Uso:
    python puzzle_piece_cutter.py <imagen> <carpeta_mascaras> [carpeta_salida]

Convención de nombres de máscaras:
    Los archivos de máscara pueden tener cualquier nombre; el ID de la pieza
    se toma del stem del archivo. Se recomienda nombrarlos así:

        piece_0_0.png   → fila 0, columna 0
        piece_0_1.png   → fila 0, columna 1
        piece_1_0.png   → fila 1, columna 0
        ...

    Las máscaras deben ser del mismo tamaño que la imagen fuente.
    Píxeles blancos = área visible de la pieza, negro = transparente.

Dependencias:
    pip install Pillow numpy
"""

import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("ERROR: Faltan dependencias. Instalalas con:")
    print("  pip install Pillow numpy")
    sys.exit(1)


def cut_pieces(image_path: str, masks_dir: str, output_dir: str) -> None:
    # ── Cargar imagen fuente ──────────────────────────────────────────────────
    src = Image.open(image_path).convert("RGBA")
    src_w, src_h = src.size
    src_arr = np.array(src)
    print(f"Imagen fuente: {Path(image_path).name}  ({src_w}×{src_h} px)")

    # ── Preparar directorios ──────────────────────────────────────────────────
    masks_path = Path(masks_dir)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    mask_files = sorted(
        list(masks_path.glob("*.png")) + list(masks_path.glob("*.jpg"))
    )

    if not mask_files:
        print(f"No se encontraron máscaras en: {masks_dir}")
        return

    print(f"Procesando {len(mask_files)} máscaras → {out_path.resolve()}\n")

    generated = 0
    for mask_file in mask_files:
        mask_img = Image.open(mask_file).convert("L")  # escala de grises

        # Redimensionar máscara si no coincide con la imagen fuente
        if mask_img.size != (src_w, src_h):
            print(f"  [!] Redimensionando {mask_file.name}: {mask_img.size} → {(src_w, src_h)}")
            mask_img = mask_img.resize((src_w, src_h), Image.LANCZOS)

        mask_arr = np.array(mask_img)

        # Calcular bounding box de los píxeles visibles de la máscara
        rows_with_content = np.any(mask_arr > 10, axis=1)
        cols_with_content = np.any(mask_arr > 10, axis=0)

        if not rows_with_content.any():
            print(f"  [!] Saltando {mask_file.name} — máscara vacía")
            continue

        r_min, r_max = np.where(rows_with_content)[0][[0, -1]]
        c_min, c_max = np.where(cols_with_content)[0][[0, -1]]

        # Recortar imagen fuente y máscara al bounding box
        piece_arr = src_arr[r_min:r_max + 1, c_min:c_max + 1].copy()
        alpha_crop = mask_arr[r_min:r_max + 1, c_min:c_max + 1]

        # Aplicar máscara como canal alpha
        piece_arr[:, :, 3] = alpha_crop

        piece_img = Image.fromarray(piece_arr, "RGBA")
        out_file = out_path / f"{mask_file.stem}.png"
        piece_img.save(out_file, "PNG")

        print(f"  ✓ {mask_file.name:<30s} → {out_file.name}  ({piece_img.width}×{piece_img.height} px)")
        generated += 1

    print(f"\n✅ Listo! {generated}/{len(mask_files)} piezas generadas en: {out_path.resolve()}")


def main():
    parser = argparse.ArgumentParser(
        description="Corta piezas de rompecabezas aplicando máscaras sobre una imagen fuente."
    )
    parser.add_argument("image",          help="Ruta a la imagen fuente")
    parser.add_argument("masks_folder",   help="Carpeta con las máscaras (PNG/JPG)")
    parser.add_argument(
        "output_folder",
        nargs="?",
        default="pieces_output",
        help="Carpeta de salida para las piezas (default: pieces_output)",
    )
    args = parser.parse_args()

    img_path = Path(args.image)
    if not img_path.exists():
        print(f"ERROR: No se encontró la imagen: {args.image}")
        sys.exit(1)

    masks_path = Path(args.masks_folder)
    if not masks_path.is_dir():
        print(f"ERROR: No es un directorio válido: {args.masks_folder}")
        sys.exit(1)

    cut_pieces(str(img_path), str(masks_path), args.output_folder)


if __name__ == "__main__":
    main()
