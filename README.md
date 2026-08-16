# CC0-Public-Domain-Models

A massive, curated collection of **100% CC0 Public Domain 3D Models** for game developers, 3D artists, and creators.

All models in this repository are converted to self-contained binary glTF (`.glb`) files with embedded materials and textures, complete with 256px still thumbnails and 360° animated WebP turntable previews.

[![Browse 3D Models on ModelibrStore](docs/store-preview.png)](https://store.modelibr.com)

---

## Live Catalog & One-Click Import

All packs in this repository are indexed and hosted on **[store.modelibr.com](https://store.modelibr.com)**:

- **Interactive 3D & Turntable Browsing**: Preview every model in 3D and animated 360° turntables directly in your browser.
- **One-Click Local Import**: Import packs and individual models directly into your local **[Modelibr](https://github.com/Papyszoo/Modelibr)** desktop instance.
- **Standardized Taxonomy**: Over 9,400+ models categorized across 16 standardized model domains (Vehicles, Weapons, Characters, Architecture, Props, Nature, Food, etc.).

---

## Included Collections

| Creator / Collection | Packs | Description |
| :--- | :--- | :--- |
| **[Kenney](https://kenney.nl)** | 50 Kits | The legendary low-poly game asset kits (City, Space, Nature, Castle, Cars, Weapons, Food, Holiday, etc.). |
| **[KayKit](https://kaylousberg.com)** | 10 Packs | Stylized modular character, dungeon, city, and restaurant kits by Kay Lousberg. |
| **[Quaternius](https://quaternius.com)** | 82 Packs | Stylized MegaKits and Ultimate packs (Medieval Village, Sci-Fi, Monsters, Guns, Farm Buildings, RPG, RTS, Cyberpunk, Characters). |
| **[The Base Mesh](https://thebasemesh.com)** | 1 MegaPack | 1,360 clean subdivision-ready base meshes across anatomy, tools, clothing, and props. |

---

## Repository Layout

Every pack is completely self-contained in its own directory:

```text
packs/
  <pack-slug>/
    pack.json              # Authored metadata (name, creator, website, license, description)
    cover.png              # Pack cover art / catalog listing thumbnail
    store-manifest.json    # Self-contained store manifest pinned to Git commit
    models/
      <model_slug>/
        <model_slug>.glb   # Binary glTF 3D model (role: Mesh)
        <model_slug>.png   # Rendered 256px thumbnail (role: Thumbnail)
        <model_slug>.webp  # 360° animated turntable (role: Turntable)
scripts/
  generate-store-manifest.mjs   # Generates per-pack store-manifest.json
  render-thumbnails.mjs         # Headless 3D thumbnail & turntable renderer
```


---

## License

All assets in this repository are dedicated to the public domain under the **[Creative Commons Zero 1.0 Universal (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/)** license. You may freely use, modify, distribute, and monetize these assets in personal and commercial projects without attribution.
