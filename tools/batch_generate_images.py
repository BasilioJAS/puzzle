import os
import json
import time
import urllib.request
import urllib.parse
from urllib.error import URLError, HTTPError

# El prompt maestro para mantener el estilo
MASTER_PROMPT = """All images must share the exact same consistent art style: a charming, digital children's storybook illustration. The art should have soft watercolor and colored pencil textures, friendly rounded shapes, bright and cheerful primary and secondary colors, and a clean, gentle feel, safe for young kids (ages 5-8). Each image focuses on a fully costumed, happy, anthropomorphic animal, clearly showing their profession. Use a soft, lightly patterned background that matches the setting, not plain white. The expression must always be joy. No violence, religion, or explicit content."""

# URL local de ComfyUI
COMFYUI_URL = "http://127.0.0.1:8188"

def queue_prompt(prompt_workflow):
    p = {"prompt": prompt_workflow}
    data = json.dumps(p).encode('utf-8')
    req =  urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read())
    except urllib.error.URLError as e:
        print(f"Error conectando a ComfyUI: {e}. ¿Está ejecutándose el servidor?")
        return None

def get_history(prompt_id):
    try:
        with urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}") as response:
            return json.loads(response.read())
    except urllib.error.URLError as e:
        return None

def get_image(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    try:
        with urllib.request.urlopen(f"{COMFYUI_URL}/view?{url_values}") as response:
            return response.read()
    except urllib.error.URLError as e:
        print(f"Error descargando imagen: {e}")
        return None

def build_comfyui_workflow(prompt_text, width, height, filename_prefix):
    # Workflow base (Default de ComfyUI adaptado a SDXL)
    return {
        "3": {
            "inputs": {
                "seed": int(time.time()), # Semilla aleatoria
                "steps": 25, # Aumentado a 25 para mejor calidad en SDXL
                "cfg": 7.0,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": "bravoChildrens_v10.safetensors" # El modelo SD 1.5 que descargaste
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {
                "text": prompt_text,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": "text, watermark, ugly, bad anatomy, bad quality",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": filename_prefix,
                "images": ["8", 0]
            },
            "class_type": "SaveImage"
        }
    }

def main():
    json_path = "prompts.json"
    output_dir = r"C:\_proyectos_ia\puzzle\imagenes_generadas"
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(json_path):
        print(f"Error: No se encontró el archivo {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)
        
    for p in prompts:
        img_id = p["id"]
        out_file = os.path.join(output_dir, f"{img_id}.png")
        
        if os.path.exists(out_file):
            print(f"[*] Imagen {img_id} ya existe. Saltando...")
            continue
            
        aspect_ratio = p.get("aspectRatio", "1:1")
        # Base de resolución SD 1.5 (aprox 512)
        width = 512
        height = 512
        if aspect_ratio == "3:4":
            width = 512
            height = 682
        elif aspect_ratio == "9:16":
            width = 432
            height = 768
        elif aspect_ratio == "16:9":
            width = 768
            height = 432
            
        print(f"[-] Generando imagen {img_id} en ComfyUI ({width}x{height})...")
        
        hack = p.get("hack", "")
        base_prompt = p["prompt"]
        
        prompt_text = f"{MASTER_PROMPT} "
        if hack:
            prompt_text += f"{hack} "
        prompt_text += f"{base_prompt}"
        
        # Enviar el prompt a ComfyUI
        workflow = build_comfyui_workflow(prompt_text, width, height, f"batch_{img_id}")
        queued_response = queue_prompt(workflow)
        
        if not queued_response:
            continue
            
        prompt_id = queued_response['prompt_id']
        print(f"   [*] Tarea enviada a la cola. ID: {prompt_id}. Esperando renderizado (esto tomará memoria y tiempo)...")
        
        # Polling para ver si terminó
        finished = False
        while not finished:
            history = get_history(prompt_id)
            if history and prompt_id in history:
                finished = True
                
                # Extraer info de la imagen guardada
                outputs = history[prompt_id].get('outputs', {})
                for node_id, node_output in outputs.items():
                    if 'images' in node_output:
                        image_info = node_output['images'][0]
                        image_data = get_image(image_info['filename'], image_info['subfolder'], image_info['type'])
                        
                        if image_data:
                            with open(out_file, 'wb') as out_f:
                                out_f.write(image_data)
                            print(f"   [✔] Imagen {img_id} generada y guardada exitosamente.")
                        break
            else:
                time.sleep(5) # Revisar cada 5 segundos

if __name__ == "__main__":
    print("Iniciando batch generator con API local de ComfyUI (DirectML)...")
    main()
