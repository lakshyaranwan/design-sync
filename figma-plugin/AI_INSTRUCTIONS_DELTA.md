# AI generator — required updates

Apply these changes to `studio_ai_instructions.txt`. They eliminate the
positioning errors and icon/no-icon variant mismatches the plugin was hitting.

## 1. `placement` MUST be pixel-precise (HARD RULE)

Replace the optional-sounding note at the bottom of the file with:

> Every component entry in `usage.json` MUST include `x`, `y`, `width`,
> `height` (numbers, pixels, measured from the 360×820 frame's top-left).
> Omitting any of these is a generation failure — re-generate until present.
> `section`, `semanticRole`, `orderInSection` stay as metadata but never
> replace the pixel coordinates.

Also add `anchor`:

```json
"placement": {
  "section": "StickyFooter",
  "anchor": "bottom",          // "top" | "bottom"
  "orderInSection": 1,
  "x": 20, "y": 740, "width": 320, "height": 52
}
```

## 2. `variantPath` must equal the exact Figma variant node name

The plugin now imports variants by Figma node key. The `variantPath` is
used only as a label and for fallback matching, so it MUST match Figma's
variant naming exactly (slash-joined, in the property order Figma stores).

Add this rule:

> When the button has no icon, the segment MUST be `No Icon`.
> When it has a leading icon, it MUST be `Icon Left`. Trailing → `Icon
> Right`. Icon-only → `Icon Only`. The `props.icon` field MUST agree:
> use one of `"None" | "Left" | "Right" | "Only"` and never a glyph
> like `"<-"`.

## 3. `figmaNodeId` is the exact variant — required

> `figmaNodeId` MUST point to the exact variant node (not the component
> set). `figmaComponentSetId` is the parent set. The plugin prefers
> `figmaNodeId` and skips variant-property guessing when it matches,
> which is the only reliable way to render icon vs no-icon correctly.

## 4. Stop emitting glyph characters as icon props

Replace examples like `"icon": "<-"` with semantic enums:

```json
"props": { "icon": "Left", "iconName": "arrow-left" }
```

`iconName` is informational; `icon` ∈ {None,Left,Right,Only} is what gates
the variant.

## 5. Drop reliance on TSX `left/top` regex

The plugin's TSX coordinate-extraction is now a last-resort fallback.
Always provide JSON coordinates; do not rely on inline `style={{ left, top }}`
in TSX to convey position.
