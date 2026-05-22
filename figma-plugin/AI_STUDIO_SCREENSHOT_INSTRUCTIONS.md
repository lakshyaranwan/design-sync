# Google AI Studio — screenshot export instructions

Append the section below to the prompt you give the AI screen generator (the
same prompt that produces `App.tsx` + `usage.json`). It makes the model also
render the screen once and save a pixel-accurate PNG that matches the
`usage.json` coordinates exactly. You then drop all three files into the
Figma plugin's import fields.

---

## ADD THIS TO YOUR GENERATOR PROMPT

You MUST produce THREE artifacts per screen, all sharing the same viewport:

1. `App.tsx` — the React screen
2. `usage.json` — component manifest with pixel-precise `placement`
3. `screen.png` — a screenshot of the rendered screen

### Hard rules for the screenshot

- **Canvas size**: exactly `360 × 820` CSS pixels at `devicePixelRatio = 1`.
  No scaling, no zoom, no browser chrome, no scrollbars in the image.
- **Background**: render against the same Mode (Light/Dark) declared in
  `usage.json`. No transparency, no checkerboard.
- **Coordinate parity**: every component's on-screen position MUST equal its
  `placement.x / y / width / height` in `usage.json`. If they disagree, fix
  the JSON to match the screenshot (the screenshot is the source of truth
  for the plugin's placement).
- **No device frame, status bar mockups, or annotations** drawn over the UI.
- **File format**: PNG, sRGB, lossless. Name it `screen.png`.
- **One file per screen**: do NOT stitch multiple screens into one image.

### How to produce it inside AI Studio

After generating `App.tsx`, do the following in the same run:

1. Mount `<App />` inside a wrapper sized to exactly `360 × 820`:
   ```tsx
   <div id="capture-root" style={{ width: 360, height: 820, overflow: 'hidden' }}>
     <App />
   </div>
   ```
2. Wait for fonts and images: `await document.fonts.ready`.
3. Capture `#capture-root` with `html-to-image` at pixelRatio 1:
   ```ts
   import { toPng } from 'html-to-image';
   const dataUrl = await toPng(document.getElementById('capture-root')!, {
     pixelRatio: 1,
     width: 360,
     height: 820,
     cacheBust: true,
   });
   ```
4. Save the resulting PNG alongside `App.tsx` and `usage.json` and offer all
   three as downloads.

If `html-to-image` is unavailable, fall back to `dom-to-image-more` with the
same options. Do NOT use `html2canvas` — it rasterizes text differently and
shifts positions by sub-pixel amounts.

### Self-check before returning the artifacts

The generator MUST verify each item below. If any check fails, regenerate.

- [ ] Screenshot dimensions are exactly 360 × 820.
- [ ] Every entry in `usage.json.components[*].placement` has numeric
      `x`, `y`, `width`, `height`.
- [ ] For each component, the rectangle drawn at `placement` on the
      screenshot visually contains that component (spot-check 3 random
      entries, including any sticky footer button).
- [ ] Every button's `props.icon ∈ {"None","Left","Right","Only"}` matches
      the icon state visible in the screenshot. If the button has no icon
      in the image, `icon` MUST be `"None"` and `variantPath` MUST contain
      `Icon=No Icon` (or the exact Figma variant segment for no-icon).
- [ ] `figmaNodeId` points to the exact variant (icon vs no-icon), not the
      component set.

### Naming for download

Bundle as `screen-<name>.zip` containing:
```
App.tsx
usage.json
screen.png
```

The user will unzip and import each file into the Figma plugin (TSX, usage,
screenshot inputs).
