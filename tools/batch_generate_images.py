import os
import json
import time
import urllib.request
import urllib.parse
from urllib.error import URLError, HTTPError

# El prompt maestro para HF Serverless Inference API
MASTER_PROMPT = """All images must share the exact same consistent art style: a charming, digital children's storybook illustration. The art should have soft watercolor and colored pencil textures, friendly rounded shapes, bright and cheerful primary and secondary colors, and a clean, gentle feel, safe for young kids (ages 5-8). Each image focuses on a fully costumed, happy, anthropomorphic animal, clearly showing their profession. Use a soft, lightly patterned background that matches the setting, not plain white. The expression must always be joy. No violence, religion, or explicit content."""

def main():
    if "HF_API_KEY" not in os.environ:
        print("Error: La variable de entorno HF_API_KEY no está configurada.")
        print("Debes crearla usando: $Env:HF_API_KEY=\"hf_TuTokenAqui\"")
        return

    hf_token = os.environ["HF_API_KEY"]
    
    json_path = "prompts.json"
    output_dir = r"C:\_proyectos_ia\puzzle\imagenes_generadas"
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(json_path):
        print(f"Error: No se encontró el archivo {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)
        
    # Usaremos el endpoint estándar para text-to-image de HF, apuntando a Stable Diffusion XL que es más robusto en la capa gratuita
    API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
    headers = {"Authorization": f"Bearer {hf_token}"}
        
    for p in prompts:
        img_id = p["id"]
        out_file = os.path.join(output_dir, f"{img_id}.png")
        
        if os.path.exists(out_file):
            print(f"[*] Imagen {img_id} ya existe. Saltando...")
            continue
            
        aspect_ratio = p.get("aspectRatio", "1:1")
        # HF Inference API para FLUX requiere width y height separados en parámetros extra (o integrados en el JSON)
        width = 1024
        height = 1024
        if aspect_ratio == "3:4":
            width = 768
            height = 1024
        elif aspect_ratio == "9:16":
            width = 576
            height = 1024
        elif aspect_ratio == "16:9":
            width = 1024
            height = 576
            
        print(f"[-] Generando imagen {img_id} ({width}x{height})...")
        
        hack = p.get("hack", "")
        base_prompt = p["prompt"]
        
        prompt_text = f"{MASTER_PROMPT} "
        if hack:
            prompt_text += f"{hack} "
        prompt_text += f"{base_prompt}"
        
        # El payload JSON para HuggingFace
        payload = {
            "inputs": prompt_text,
            "parameters": {
                "width": width,
                "height": height,
                "num_inference_steps": 4 # FLUX Schnell necesita muy pocos steps
            }
        }
        data = json.dumps(payload).encode('utf-8')
        
        retries = 3
        while retries > 0:
            try:
                req = urllib.request.Request(API_URL, data=data, headers=headers)
                
                with urllib.request.urlopen(req, timeout=120) as response:
                    # HF devuelve directamente los bytes de la imagen si fue exitoso
                    image_bytes = response.read()
                    with open(out_file, 'wb') as out_f:
                        out_f.write(image_bytes)
                    
                print(f"   [✔] Imagen {img_id} descargada de HuggingFace.")
                time.sleep(2) # Pausa amigable para no saturar
                break
                
            except HTTPError as e:
                # Si el modelo está "durmiendo" (Loading), HF suele devolver 503
                error_body = e.read().decode('utf-8')
                print(f"   [x] Error HTTP {e.code}: {error_body}")
                if "is currently loading" in error_body:
                    print("   [*] El modelo se está despertando. Esperando 20 segundos...")
                    time.sleep(20)
                else:
                    print("   [*] Esperando 10 segundos antes de reintentar...")
                    time.sleep(10)
                retries -= 1
            except Exception as e:
                print(f"   [x] Error inesperado: {e}")
                time.sleep(5)
                retries -= 1

if __name__ == "__main__":
    print("Iniciando batch con HuggingFace API (FLUX.1)...")
    main()
