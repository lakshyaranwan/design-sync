# Capture server

A tiny localhost endpoint the Figma plugin can pull from so you don't have to
manually export a screenshot every time.

## Run

```bash
node figma-plugin/capture-server/server.mjs
# -> Capture server listening on http://localhost:8765
```

## Wire into your preview app

Install `html2canvas` in the project that renders the screen:

```bash
bun add html2canvas
```

Add a dev-only capture button somewhere in the preview (e.g. a floating
button in `src/App.tsx`). It snapshots `#root`, reads the colocated
`usage.json` and `App.tsx` source via Vite's `?raw` import, and POSTs to the
capture server:

```tsx
import html2canvas from 'html2canvas';
import usageJson from './SenMoneySendTo.usage.json';
import tsxSource from './App.tsx?raw';

async function capture() {
  const root = document.getElementById('root')!;
  const canvas = await html2canvas(root, { backgroundColor: null, scale: 2 });
  const screenshotBase64 = canvas.toDataURL('image/png');
  await fetch('http://localhost:8765/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotBase64,
      usageJson,
      tsx: tsxSource,
      width: root.offsetWidth,
      height: root.offsetHeight,
    }),
  });
}
```

## In Figma

1. Open the plugin → **Capture from preview** (URL defaults to
   `http://localhost:8765/capture/latest`).
2. The plugin loads the screenshot + usage.json + tsx and runs the same
   parse/build pipeline as the manual file flow.
3. Click **Build screen**.
