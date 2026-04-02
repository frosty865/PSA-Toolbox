# Folder creators

## create_sector_subsector_folders.py

Creates a folder structure:

  D:\PSA_System\data\download\<SECTOR_CODE>\<SUBSECTOR_CODE>\

Edit `TAXONOMY_FILE` in the script to point at your taxonomy JSON.

Supported taxonomy shapes:
- `{"sectors":[{"code":"ENERGY","subsectors":[{"code":"ELECTRIC"}]}]}`
- `{"sectors":[{"code":"ENERGY","subsectors":["ELECTRIC","OIL_GAS"]}]}`
- `[{"code":"ENERGY","subsectors":[...]}]`

Usage:
```bash
python tools/fs/create_sector_subsector_folders.py
```
