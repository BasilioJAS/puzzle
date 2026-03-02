import json
import math
import os
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider, Button
from collections import OrderedDict

# --- Parámetros Iniciales ---
NUM_LEVELS = 100
INITIAL_PIECES = 4    # Ej 2x2
MAX_PIECES_TARGET = 100 # Ej 10x10

# Tiempo base para piezas y penalizaciones
TIME_PER_PIECE_BASE = 15.0  # Segundos generosos por pieza en nivel 1
TIME_PER_PIECE_MIN = 3.0    # Segundos hardcore por pieza en max level

# --- Funciones de Cálculo ---
def get_grid_for_pieces(target_pieces, prefer_wide=False):
    # Encuentra la grilla NxM más cercana a target_pieces
    best_diff = float('inf')
    best_grid = (2, 2)
    
    # Buscamos combinaciones posibles razonables
    max_side = math.ceil(math.sqrt(target_pieces * 2))
    
    for r in range(2, max_side + 1):
        for c in range(r, max_side + 1): # c >= r => mas apaisado
            p = r * c
            diff = abs(p - target_pieces)
            if diff < best_diff:
                best_diff = diff
                best_grid = (c, r) if prefer_wide else (r, c)
            
            # Si permite grids exactos o un poquito pasados
            if p >= target_pieces and diff <= best_diff:
                 best_grid = (c, r) if prefer_wide else (r, c)
                 
    return best_grid

def generate_curve_data(exponent, time_exponent, prefer_wide=False):
    levels = []
    
    for i in range(NUM_LEVELS):
        progress = i / (NUM_LEVELS - 1) if NUM_LEVELS > 1 else 0
        
        # Curva de crecimiento de piezas (exponencial o logarítmica)
        # exponente > 1: Lento al principio, rápido al final.
        # exponente < 1: Rápido al principio, lento al final.
        target_pieces = INITIAL_PIECES + (MAX_PIECES_TARGET - INITIAL_PIECES) * (progress ** exponent)
        
        c, r = get_grid_for_pieces(target_pieces, prefer_wide)
        actual_pieces = c * r
        
        # Curva de decaimiento del tiempo permitido por pieza
        # time_exponent > 1: El tiempo sobra bastante, cae rápido al final
        time_per_piece = TIME_PER_PIECE_MIN + (TIME_PER_PIECE_BASE - TIME_PER_PIECE_MIN) * ((1.0 - progress) ** time_exponent)
        
        total_time = math.ceil(actual_pieces * time_per_piece)
        
        levels.append({
            "id": i + 1,
            "target_pieces": target_pieces,
            "actual_pieces": actual_pieces,
            "cols": c,
            "rows": r,
            "timeLimit": total_time
        })
    return levels

# --- UI y Gráficos ---
fig, (ax_pieces, ax_time) = plt.subplots(2, 1, figsize=(10, 8))
plt.subplots_adjust(left=0.1, bottom=0.35, hspace=0.4)

curve_line, = ax_pieces.plot([], [], 'o-', color='b', label='Actual Pieces')
target_line, = ax_pieces.plot([], [], '--', color='gray', alpha=0.5, label='Target Trend')
time_line, = ax_time.plot([], [], 'o-', color='r', label='Time Limit (s)')

ax_pieces.set_title('Difficulty Curve (Pieces)')
ax_pieces.set_xlabel('Level')
ax_pieces.set_ylabel('Pieces')
ax_pieces.grid(True)
ax_pieces.legend()

ax_time.set_title('Time Limit Curve')
ax_time.set_xlabel('Level')
ax_time.set_ylabel('Seconds')
ax_time.grid(True)
ax_time.legend()

# Sliders
axcolor = 'lightgoldenrodyellow'
ax_exp = plt.axes([0.15, 0.20, 0.65, 0.03], facecolor=axcolor)
ax_time_exp = plt.axes([0.15, 0.15, 0.65, 0.03], facecolor=axcolor)
ax_max_p = plt.axes([0.15, 0.10, 0.65, 0.03], facecolor=axcolor)

s_exp = Slider(ax_exp, 'Piece Exp', 0.1, 4.0, valinit=2.0)
s_time_exp = Slider(ax_time_exp, 'Time Exp', 0.1, 4.0, valinit=1.0)
s_max_p = Slider(ax_max_p, 'Max Pieces', 10, 300, valinit=100, valstep=1)

def update(val):
    global MAX_PIECES_TARGET
    MAX_PIECES_TARGET = s_max_p.val
    
    levels = generate_curve_data(s_exp.val, s_time_exp.val)
    
    x = [lvl['id'] for lvl in levels]
    y_target = [lvl['target_pieces'] for lvl in levels]
    y_actual = [lvl['actual_pieces'] for lvl in levels]
    y_time = [lvl['timeLimit'] for lvl in levels]
    
    curve_line.set_data(x, y_actual)
    target_line.set_data(x, y_target)
    ax_pieces.set_xlim(1, NUM_LEVELS)
    ax_pieces.set_ylim(0, max(y_actual) * 1.1)
    
    time_line.set_data(x, y_time)
    ax_time.set_xlim(1, NUM_LEVELS)
    ax_time.set_ylim(0, max(y_time) * 1.1)
    
    fig.canvas.draw_idle()

s_exp.on_changed(update)
s_time_exp.on_changed(update)
s_max_p.on_changed(update)

# Botón Exportar JSON
export_ax = plt.axes([0.7, 0.025, 0.12, 0.04])
btn_export = Button(export_ax, 'Export JSON', hovercolor='0.975')

# Botón Copiar Prompts
copy_ax = plt.axes([0.83, 0.025, 0.12, 0.04])
btn_copy = Button(copy_ax, 'Copy List', hovercolor='0.975')

def export_json(event):
    levels = generate_curve_data(s_exp.val, s_time_exp.val)
    
    # Preparamos el array de niveles limpio para el juego
    output_levels = []
    for lvl in levels:
        output_levels.append({
            "id": lvl['id'],
            "timeLimit": lvl['timeLimit'],
            "cols": lvl['cols'],
            "rows": lvl['rows']
        })
    
    out_path = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'levels_curve.json')
    with open(out_path, 'w') as f:
        json.dump(output_levels, f, indent=4)
        
    print(f"Exportado exitosamente a {out_path}!")

def copy_list(event):
    import tkinter as tk
    levels = generate_curve_data(s_exp.val, s_time_exp.val)
    
    lines = ["Resoluciones por nivel para Arte:"]
    for lvl in levels:
        lines.append(f"Level {lvl['id']}: {lvl['cols']}x{lvl['rows']}")
        
    text_to_copy = "\n".join(lines)
    
    # Copiar usando tkinter
    r = tk.Tk()
    r.withdraw()
    r.clipboard_clear()
    r.clipboard_append(text_to_copy)
    r.update() # takes time, but ensures it stays in clipboard
    r.destroy()
    print("¡Texto detallado copiado al portapapeles!")

btn_export.on_clicked(export_json)
btn_copy.on_clicked(copy_list)

# Init
update(0)
plt.show()
