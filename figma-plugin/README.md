# Sen Money DS Mapper

Figma plugin that reads a generated `.jsx` screen file + `.usage.json` manifest and rebuilds the screen inside Figma, linking every instance to the Sen Money design library.

## Build

```bash
cd figma-plugin
npm install
npm run build
```

Then in Figma desktop: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

## Use

1. Open the plugin.
2. **Panel 1 — Import**: drop the `.jsx` and `.usage.json`, click **Parse** to preview matches.
3. **Panel 2 — Placement**: pick a target frame (or create one), size preset, Light/Dark mode, then **Build screen**.
4. Watch the log; review the summary bar; click **Zoom to frame**.

Missing components are placed as dashed red placeholder frames so layout intent is preserved.

## Files

- `manifest.json` — Figma plugin manifest
- `ui.html` — plugin UI (two panels, vanilla JS)
- `src/code.ts` — main thread logic (compiled to `code.js`)

## Extras

- **Re-sync**: select a previously built frame, click *Re-sync* to refresh instances to latest library version.
- **Audit**: select a built frame, click *Audit* to export a JSON report of stale / missing components.
- **Reverse export**: select a built frame, click *Reverse export* to regenerate a `usage.json`.
