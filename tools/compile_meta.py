#!/usr/bin/env python3
import json
import os
from pathlib import Path

def main():
    project_root = Path(__file__).resolve().parent.parent
    levels_dir = project_root / "public" / "assets" / "levels"
    
    if not levels_dir.exists():
        print(f"Directory not found: {levels_dir}")
        return

    meta_dict = {}

    for d in levels_dir.iterdir():
        if d.is_dir():
            data_file = d / "level_data.json"
            if data_file.exists():
                try:
                    with open(data_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        meta_dict[str(data["id"])] = data
                except Exception as e:
                    print(f"Error reading {data_file}: {e}")

    out_file = project_root / "public" / "assets" / "levels_meta.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(meta_dict, f, indent=4)
        print(f"Compiled metadata for {len(meta_dict)} levels into {out_file.name}")

if __name__ == "__main__":
    main()
