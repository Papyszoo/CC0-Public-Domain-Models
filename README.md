# CC0-Public-Domain-Models

CC0 model packs for [ModelibrStore](https://store.modelibr.com), each converted
to glTF binary with a rendered thumbnail and an animated turntable per model.
The first pack is derived from https://thebasemesh.com — real-world scale,
basic UVs — and works for drag-and-drop into real-time editors
(https://hyperfy.io, [webaverse](https://github.com/webaverse-studios),
[janusweb](https://github.com/jbaicoianu/janusweb), …).

Upstream gallery: https://m3-org.github.io/base-meshes/

![image](https://user-images.githubusercontent.com/32600939/233737833-49e9aa5f-4471-4fa3-8d77-2c1a80710fa8.png)

## Layout

```
packs/
  the-base-mesh/
    pack.json              authored metadata (name, creator, website, licence, description)
    cover.png              the catalog listing image — the pack's own artwork
    models/
      180_twist/
        180_twist.glb      the model            → role Mesh
        180_twist.png      still thumbnail      → Thumbnail preview for that item
        180_twist.webp     animated turntable   → Turntable preview for that item
scripts/
store-manifest.json        generated — do not hand-edit
category-report.txt        generated — review category assignments here
```

`store-manifest.json` is the ready-to-upload external-pack manifest: every file
with its SHA-256, pinned to the commit that last changed `packs/`. Its
`{ source, license, packs: [...] }` shape matches the CC0-Public-Domain-Sounds
repo, so one submitter publishes either.

## Adding a pack

1. Create `packs/<slug>/` with `pack.json`, `cover.png` and
   `models/<model_slug>/<model_slug>.glb`. Per-model `.png` and `.webp`
   previews are optional but strongly wanted — without them the item has no
   picture in the store or in Modelibr.
2. `pack.json` requires `name`, `creator`, `website`, `license` and
   `description`. `name` is the store listing title and the submitter's
   idempotency key, so it must stay stable once published.
3. Commit **and push** the new files. URLs pin to the commit that last touched
   `packs/`, and an unpushed commit produces URLs the store cannot fetch.
4. Regenerate: `node scripts/generate-store-manifest.mjs`. It refuses to run on
   a dirty or unpushed `packs/`, so a stale pin can't reach the store.
5. Review `category-report.txt` — every model is auto-assigned a category from
   the store's universal taxonomy by keyword, defaulting to `Props`. Curate by
   extending `KEYWORD_CATEGORIES` in the generator and rerunning.
6. Commit the regenerated manifest, then publish: store Admin → Upload →
   **External pack (GitHub-hosted)** → *Load manifest file (.json)*.

## Covers

`cover.png` is the pack-level listing image. Prefer the original author's own
artwork where its licence allows it; the current one is thebasemesh.com's
official render of these meshes. A pack without `cover.png` fails generation on
purpose: with no pack-level image the store falls back to whichever item sorts
first, which is how the published pack ended up advertised by a random mesh.
