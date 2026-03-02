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

    import re

    # Determinar tamaño de la grilla (max filas y columnas basados en nombres de archivo)
    max_r, max_c = 0, 0
    parsed_masks = []
    
    # Patrón: detecta numbers en `piece_0_1.png`
    pattern = re.compile(r'_(\d+)_(\d+)')
    
    for mask_file in mask_files:
        match = pattern.search(mask_file.name)
        if match:
            r, c = int(match.group(1)), int(match.group(2))
            max_r = max(max_r, r)
            max_c = max(max_c, c)
            parsed_masks.append((mask_file, r, c))
        else:
            print(f"  [!] Saltando {mask_file.name}: no sigue el formato piece_R_C")
            continue
            
    if not parsed_masks:
        print("No se encontraron archivos con el formato: piece_<fila>_<columna>.png")
        return

    cols = max_c + 1
    rows = max_r + 1
    
    # Calculamos el tamaño de celda base partiendo del tamaño de la imagen puente y la grilla
    # Asumimos que la imagen fuente representa el puzzle completo
    cell_w = src_w // cols
    cell_h = src_h // rows

    # Encontrar el bounding box MÁXIMO (cuánto sobresale cualquier pestaña en cualquier dirección)
    # para crear un tamaño de textura uniforme centrado.
    max_pad_top = 0
    max_pad_bottom = 0
    max_pad_left = 0
    max_pad_right = 0

    print("Calculando dimensiones uniformes de piezas...")
    for mask_file, r, c in parsed_masks:
        mask_img = Image.open(mask_file).convert("L")
        if mask_img.size != (src_w, src_h):
            mask_img = mask_img.resize((src_w, src_h), Image.LANCZOS)
        mask_arr = np.array(mask_img)

        rows_with_content = np.any(mask_arr > 10, axis=1)
        cols_with_content = np.any(mask_arr > 10, axis=0)

        if not rows_with_content.any(): continue

        rmin_mask, rmax_mask = np.where(rows_with_content)[0][[0, -1]]
        cmin_mask, cmax_mask = np.where(cols_with_content)[0][[0, -1]]

        # Celda teórica de esta pieza:
        cell_y0 = r * cell_h
        cell_x0 = c * cell_w

        # Cuánto sobresale de su celda teórica
        pad_top = cell_y0 - rmin_mask
        pad_bottom = rmax_mask - (cell_y0 + cell_h - 1)
        pad_left = cell_x0 - cmin_mask
        pad_right = cmax_mask - (cell_x0 + cell_w - 1)

        max_pad_top = max(max_pad_top, pad_top)
        max_pad_bottom = max(max_pad_bottom, pad_bottom)
        max_pad_left = max(max_pad_left, pad_left)
        max_pad_right = max(max_pad_right, pad_right)

    # Para que el recorte de la pieza quede PERFECTAMENTE centrado alrededor de 
    # la cuadrícula teórica, el padding izquierdo y derecho deben ser el mismo (el máximo)
    # e igual en top y bottom.
    pad_h = max(max_pad_left, max_pad_right)
    pad_v = max(max_pad_top, max_pad_bottom)

    # El tamaño final de TODA LAS PIEZAS será:
    final_w = cell_w + pad_h * 2
    final_h = cell_h + pad_v * 2

    print(f"Dimensiones unificadas por pieza: {final_w}x{final_h}px (Padding V:{pad_v} H:{pad_h})")
    print(f"Procesando {len(parsed_masks)} máscaras → {out_path.resolve()}\n")

    generated = 0
    for mask_file, r, c in parsed_masks:
        mask_img = Image.open(mask_file).convert("L")
        if mask_img.size != (src_w, src_h):
            mask_img = mask_img.resize((src_w, src_h), Image.LANCZOS)
        mask_arr = np.array(mask_img)
        
        # Crear un canvas RGBA transparente del tamaño unificado
        piece_canvas = np.zeros((final_h, final_w, 4), dtype=np.uint8)

        # Ubicación teórica de la celda en la imagen fuente
        cell_y0 = r * cell_h
        cell_x0 = c * cell_w

        # Ubicación donde debemos "pegar" el recorte fuente en nuestro canvas unificado
        # El origen X de la celda teórica en el canvas unificado es `pad_h`
        # El origen Y es `pad_v`
        
        # Bounding box real de la máscara para esta pieza:
        rows_with_content = np.any(mask_arr > 10, axis=1)
        cols_with_content = np.any(mask_arr > 10, axis=0)
        
        if rows_with_content.any():
            rmin_mask, rmax_mask = np.where(rows_with_content)[0][[0, -1]]
            cmin_mask, cmax_mask = np.where(cols_with_content)[0][[0, -1]]
            
            # Recorte desde la imagen fuente y su máscara
            crop_rgb = src_arr[rmin_mask:rmax_mask + 1, cmin_mask:cmax_mask + 1, :3]
            crop_alpha = mask_arr[rmin_mask:rmax_mask + 1, cmin_mask:cmax_mask + 1]
            
            # En dónde se ubica este bbox dentro del canvas unificado?
            # Su posición Y arranca en pad_v - (lo que sobresalió top)
            offset_y = pad_v - (cell_y0 - rmin_mask)
            offset_x = pad_h - (cell_x0 - cmin_mask)
            
            h_crop, w_crop = crop_alpha.shape
            
            piece_canvas[offset_y:offset_y+h_crop, offset_x:offset_x+w_crop, :3] = crop_rgb
            piece_canvas[offset_y:offset_y+h_crop, offset_x:offset_x+w_crop, 3] = crop_alpha

        piece_img = Image.fromarray(piece_canvas, "RGBA")
        out_file = out_path / f"{mask_file.stem}.png"
        piece_img.save(out_file, "PNG")

        print(f"  ✓ {mask_file.name:<30s} → {out_file.name}  ({final_w}×{final_h} px)")
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
