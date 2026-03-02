import json
import re

input_file = r"c:\_proyectos_ia\puzzle\prompts imagenes.md"
output_file = r"c:\_proyectos_ia\puzzle\tools\prompts.json"

with open(input_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

prompts = []
for line in lines:
    line = line.strip()
    if not line: continue
    
    # Try to match start with digits
    match = re.match(r"^(\d+)\s*(?:\[(.*?)\])?\s*(.*)$", line)
    if match:
        img_id = int(match.group(1))
        hack = match.group(2) if match.group(2) else ""
        prompt_text = match.group(3).strip()
        
        # Decide Aspect Ratio. Imagen 3 only supports 1:1, 3:4, 4:3, 9:16, 16:9
        # Default is 1:1. If hack implies vertical, use 3:4 or 9:16.
        aspect_ratio = "1:1"
        if hack:
            if any(ratio in hack for ratio in ["3:4", "2:3", "3:5", "2:4", "2:5", "2:6", "3:6", "4:5", "3:7", "4:6", "4:7", "5:6"]):
                aspect_ratio = "3:4" 
            elif "16:9" in hack:
                aspect_ratio = "16:9"
            elif "9:16" in hack:
                aspect_ratio = "9:16"
            elif "square" in hack.lower() or "1:1" in hack:
                aspect_ratio = "1:1"
            else:
                aspect_ratio = "3:4" # Fallback if vertical orientation was mentioned but ratio undocumented

        prompts.append({
            "id": img_id,
            "aspectRatio": aspect_ratio,
            "hack": hack,
            "prompt": prompt_text
        })
        
# Sort by ID
prompts.sort(key=lambda x: x["id"])

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(prompts, f, indent=4, ensure_ascii=False)
    
print(f"Generated {len(prompts)} prompts in {output_file}")
