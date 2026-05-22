// Sen Money DS Mapper — main thread (screenshot + overlay approach)

// ---------- Types ----------
interface ComponentEntry {
  component: string;
  variantPath: string;
  figmaNodeId: string;
  figmaComponentSetId: string;
  props: Record<string, any>;
  tokens: {
    background?: string;
    labelColor?: string;
    typography?: string;
  };
  placement: {
    section: string;
    semanticRole: string;
    orderInSection: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  accessibility: {
    role: string;
    ariaLabel?: string;
  };
}

interface TokenEntry {
  name: string;
  value: string;
}

interface UsageManifest {
  screen: string;
  designMdVersion: string;
  viewport: { width: number; height: number };
  components: ComponentEntry[];
  tokens: TokenEntry[];
  layoutTokens: string[];
  missing: string[];
  approximate: string[];
}

interface PlacementInstruction extends ComponentEntry {
  globalOrder: number;
  widthHint?: number;
  heightHint?: number;
}

interface BuildReport {
  screen: string;
  frameNodeId: string;
  total: number;
  exactMatch: number;
  nameMatch: number;
  missing: string[];
  approximate: string[];
  mdVersion?: string;
  customCount?: number;
}

const KNOWN_MD_VERSIONS = ['1.0', '1.1', '1.2'];

// ---------- State ----------
let parsedManifest: UsageManifest | null = null;
let parsedInstructions: PlacementInstruction[] = [];
let parsedJsxText: string = '';

// ---------- UI ----------
figma.showUI(__html__, { width: 880, height: 640 });

function uiLog(line: string, color?: string) {
  figma.ui.postMessage({ type: 'log', payload: { line, color } });
}
function uiError(message: string) {
  figma.ui.postMessage({ type: 'error', payload: { message } });
}

// ---------- Init ----------
async function sendInit() {
  const frames = figma.currentPage.children
    .filter((n) => n.type === 'FRAME')
    .map((n) => ({ id: n.id, name: n.name }));

  // Figma has no public API to enumerate connected libraries from a plugin.
  // Default to "connected" and let resolveComponent / importComponentByKeyAsync
  // surface real errors during build. Only flag false on explicit failure.
  let librariesConnected = true;
  try {
    const tl = (figma as any).teamLibrary;
    if (tl && tl.getAvailableLibraryComponentsAsync) {
      const available = await tl.getAvailableLibraryComponentsAsync();
      uiLog('Library components found: ' + (available ? available.length : 0));
    } else {
      uiLog('teamLibrary enumeration API unavailable — will rely on importComponentByKeyAsync.');
    }
  } catch (e) {
    uiLog('Library enumeration failed: ' + ((e as Error).message || e));
  }

  figma.ui.postMessage({ type: 'frames', payload: { frames, librariesConnected } });
}

// ---------- Parsing ----------
function parseUsage(text: string): UsageManifest {
  const json = JSON.parse(text);
  if (!json || typeof json !== 'object') throw new Error('usage.json is not an object');
  if (!Array.isArray(json.components)) throw new Error('usage.json missing components[]');
  json.components.forEach((c: any, i: number) => {
    if (!c.component || !c.variantPath) {
      throw new Error(`components[${i}] missing component or variantPath`);
    }
    c.props = c.props || {};
    c.tokens = c.tokens || {};
    c.placement = c.placement || { section: 'Body', semanticRole: '', orderInSection: i };
    c.accessibility = c.accessibility || { role: '' };
    c.figmaNodeId = c.figmaNodeId || '';
    c.figmaComponentSetId = c.figmaComponentSetId || '';
  });
  return json as UsageManifest;
}

interface JsxHint {
  component?: string;
  variant?: string;
  nodeId?: string;
}

function parseJsxHints(text: string): JsxHint[] {
  const hints: JsxHint[] = [];
  const tagRegex = /<[A-Za-z][^>]*data-ds-component=["']([^"']+)["'][^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(text)) !== null) {
    const tag = m[0];
    const grab = (re: RegExp) => {
      const x = re.exec(tag);
      return x ? x[1] : undefined;
    };
    hints.push({
      component: m[1],
      variant: grab(/data-ds-variant=["']([^"']+)["']/),
      nodeId: grab(/data-ds-node-id=["']([^"']+)["']/),
    });
  }
  return hints;
}

// Fallback: read x/y/width/height for a DS component from the TSX file
function extractCoordinatesFromTsx(
  tsxText: string,
  componentName: string,
): { x: number; y: number; width: number; height: number } {
  const lines = tsxText.split('\n');
  const coords = { x: 0, y: 0, width: 320, height: 48 };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('data-ds-component="' + componentName + '"') === -1) continue;
    const block = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join(' ');
    const left = block.match(/left[:\s]+(\d+)/);
    const top = block.match(/top[:\s]+(\d+)/);
    const w = block.match(/width[:\s]+(\d+)/);
    const h = block.match(/height[:\s]+(\d+)/);
    if (left) coords.x = parseInt(left[1], 10);
    if (top) coords.y = parseInt(top[1], 10);
    if (w) coords.width = parseInt(w[1], 10);
    if (h) coords.height = parseInt(h[1], 10);
    break;
  }
  return coords;
}

function buildInstructions(
  manifest: UsageManifest,
  hints: JsxHint[],
): { instructions: PlacementInstruction[]; warnings: string[] } {
  const warnings: string[] = [];
  const hintQueueByComponent: Record<string, JsxHint[]> = {};
  for (const h of hints) {
    if (!h.component) continue;
    (hintQueueByComponent[h.component] = hintQueueByComponent[h.component] || []).push(h);
  }

  const enriched: PlacementInstruction[] = manifest.components.map((c, i) => {
    const queue = hintQueueByComponent[c.component];
    const hint = queue && queue.length ? queue.shift() : undefined;

    if (hint && hint.variant && hint.variant !== c.variantPath) {
      warnings.push(
        `Mismatch for ${c.component}: JSX="${hint.variant}" vs usage.json="${c.variantPath}". Using usage.json.`,
      );
    }

    return Object.assign({}, c, {
      variantPath: c.variantPath,
      figmaNodeId: c.figmaNodeId || (hint && hint.nodeId) || '',
      globalOrder: i,
    }) as PlacementInstruction;
  });

  return { instructions: enriched, warnings };
}

// ---------- Component lookup ----------
type MatchType = 'exact-id' | 'name-match' | 'set-variant' | 'missing';

function parseVariantPath(path: string): Record<string, string> {
  const segments = path.split('/').slice(1);
  const keys = ['Style', 'Size', 'Icon', 'State', 'Mode'];
  const result: Record<string, string> = {};
  keys.forEach((k, i) => {
    if (segments[i]) result[k] = segments[i];
  });
  return result;
}

function matchesVariantProps(node: ComponentNode, props: Record<string, string>): boolean {
  const vp = (node as any).variantProperties as Record<string, string> | null;
  if (!vp) return false;
  return Object.keys(props).every((k) => vp[k] === props[k]);
}

function climbToComponentRoot(
  node: BaseNode,
): { type: 'COMPONENT' | 'COMPONENT_SET'; node: BaseNode } | null {
  let cur: BaseNode | null = node;
  while (cur) {
    if (cur.type === 'COMPONENT' || cur.type === 'COMPONENT_SET') {
      return { type: cur.type, node: cur };
    }
    cur = (cur as any).parent || null;
  }
  return null;
}

function pickVariantFromSet(
  set: ComponentSetNode,
  entry: PlacementInstruction,
  mode: 'Light' | 'Dark',
): ComponentNode | null {
  const variantProps = parseVariantPath(entry.variantPath);
  const sample = set.children[0] && (set.children[0] as any).variantProperties;
  if (variantProps.Mode || (sample && sample.Mode)) {
    variantProps.Mode = mode;
  }
  const exact = (set.children as ComponentNode[]).find((c) =>
    matchesVariantProps(c, variantProps),
  );
  if (exact) return exact;
  let best: { node: ComponentNode; score: number } | null = null;
  for (const c of set.children as ComponentNode[]) {
    const vp = (c as any).variantProperties as Record<string, string> | null;
    if (!vp) continue;
    let score = 0;
    for (const k of Object.keys(variantProps)) if (vp[k] === variantProps[k]) score++;
    if (!best || score > best.score) best = { node: c, score };
  }
  return best ? best.node : null;
}

async function resolveComponent(
  entry: PlacementInstruction,
  mode: 'Light' | 'Dark',
): Promise<{ node: ComponentNode | null; matchType: MatchType }> {
  // 1. Local file lookups (same-file components)
  if (entry.figmaComponentSetId) {
    try {
      const setNode = await figma.getNodeByIdAsync(entry.figmaComponentSetId);
      if (setNode && setNode.type === 'COMPONENT_SET') {
        const match = pickVariantFromSet(setNode as ComponentSetNode, entry, mode);
        if (match) return { node: match, matchType: 'set-variant' };
      }
    } catch (e) {}
  }

  if (entry.figmaNodeId) {
    try {
      const node = await figma.getNodeByIdAsync(entry.figmaNodeId);
      if (node) {
        let cur: BaseNode | null = node;
        while (cur) {
          if (cur.type === 'COMPONENT_SET') {
            const match = pickVariantFromSet(cur as ComponentSetNode, entry, mode);
            if (match) return { node: match, matchType: 'set-variant' };
          }
          if (cur.type === 'COMPONENT') {
            const parent = (cur as ComponentNode).parent;
            if (parent && parent.type === 'COMPONENT_SET') {
              const match = pickVariantFromSet(parent as ComponentSetNode, entry, mode);
              if (match) return { node: match, matchType: 'set-variant' };
            }
            return { node: cur as ComponentNode, matchType: 'exact-id' };
          }
          cur = (cur as any).parent || null;
        }
      }
    } catch (e) {}
  }

  // 2. External library — importComponentByKeyAsync
  try {
    const tl = (figma as any).teamLibrary;
    if (tl && tl.getAvailableLibraryComponentsAsync) {
      const available = await tl.getAvailableLibraryComponentsAsync();

      // Strategy A: match by figmaComponentSetId embedded in key
      if (entry.figmaComponentSetId) {
        const idFragment = entry.figmaComponentSetId.replace(':', '');
        for (let i = 0; i < available.length; i++) {
          const c = available[i];
          if (c.key && c.key.indexOf(idFragment) !== -1) {
            try {
              const imported = await figma.importComponentByKeyAsync(c.key);
              if (imported) {
                const parentSet = imported.parent;
                if (parentSet && parentSet.type === 'COMPONENT_SET') {
                  const match = pickVariantFromSet(parentSet as ComponentSetNode, entry, mode);
                  if (match) return { node: match, matchType: 'set-variant' };
                }
                return { node: imported, matchType: 'exact-id' };
              }
            } catch (e) {}
          }
        }
      }

      // Strategy B: exact name match (skip internal .Foo names)
      const exactName = entry.component.toLowerCase();
      const candidates: any[] = [];
      for (let i = 0; i < available.length; i++) {
        const c = available[i];
        const cName = c.name.toLowerCase();
        if (cName.charAt(0) === '.') continue;
        const baseName = cName.split('/')[0].trim();
        if (baseName === exactName) candidates.push(c);
      }

      // Strategy C: partial match fallback
      if (candidates.length === 0) {
        for (let i = 0; i < available.length; i++) {
          const c = available[i];
          if (c.name.charAt(0) === '.') continue;
          if (c.name.toLowerCase().indexOf(exactName) !== -1) {
            candidates.push(c);
          }
        }
      }

      for (let j = 0; j < candidates.length; j++) {
        try {
          const imported = await figma.importComponentByKeyAsync(candidates[j].key);
          if (!imported) continue;
          const parentSet = imported.parent;
          if (parentSet && parentSet.type === 'COMPONENT_SET') {
            const match = pickVariantFromSet(parentSet as ComponentSetNode, entry, mode);
            if (match) return { node: match, matchType: 'set-variant' };
            if (parentSet.name.toLowerCase() === exactName) {
              const defaultVariant = (parentSet as ComponentSetNode).defaultVariant || imported;
              return { node: defaultVariant, matchType: 'name-match' };
            }
          }
          if (imported.name.toLowerCase().indexOf(exactName) !== -1) {
            return { node: imported, matchType: 'name-match' };
          }
        } catch (e) {
          uiLog('  ! import failed for ' + candidates[j].name + ': ' + ((e as Error).message || e), '#fbbf24');
        }
      }
    }
  } catch (e) {
    uiLog('  ! library search error: ' + ((e as Error).message || e), '#fca5a5');
  }

  return { node: null, matchType: 'missing' };
}

// ---------- Helpers ----------
async function setTextContent(instance: InstanceNode, label: string) {
  const textNodes = instance.findAll((n) => n.type === 'TEXT') as TextNode[];
  if (textNodes.length === 0) return;
  const t = textNodes[0];
  try {
    await figma.loadFontAsync(t.fontName as FontName);
    t.characters = label;
  } catch (e) {
    uiLog(`  ! font load failed: ${(e as Error).message}`, '#fbbf24');
  }
}

// ---------- Build (screenshot + overlay) ----------
async function buildScreen(
  manifest: UsageManifest,
  instructions: PlacementInstruction[],
  screenshotBytes: Uint8Array,
  options: { width: number; height: number; mode: 'Light' | 'Dark' },
): Promise<BuildReport> {
  // 1. Root frame at screenshot dimensions, absolute positioning
  const frame = figma.createFrame();
  frame.name = manifest.screen || 'DS Mapped Screen';
  frame.resize(options.width, options.height);
  frame.layoutMode = 'NONE';
  frame.clipsContent = true;

  // 2. Place screenshot as image fill
  try {
    const imageHash = figma.createImage(screenshotBytes).hash;
    frame.fills = [{ type: 'IMAGE', imageHash, scaleMode: 'FILL' }];
  } catch (e) {
    uiLog(`! screenshot fill failed: ${(e as Error).message}`, '#fca5a5');
  }

  // 3. Position on canvas
  frame.x = figma.viewport.center.x - options.width / 2;
  frame.y = figma.viewport.center.y - options.height / 2;
  figma.currentPage.appendChild(frame);

  // 4. Overlay each DS component
  let exactMatch = 0;
  let nameMatch = 0;
  const missing: string[] = [];
  const approximate: string[] = [];

  for (const instr of instructions) {
    uiLog(`  • ${instr.component} ${instr.variantPath}`);

    // Coords: prefer usage.json placement, fall back to TSX extraction
    let coords = {
      x: typeof instr.placement.x === 'number' ? instr.placement.x : 0,
      y: typeof instr.placement.y === 'number' ? instr.placement.y : 0,
      width: typeof instr.placement.width === 'number' ? instr.placement.width : 0,
      height: typeof instr.placement.height === 'number' ? instr.placement.height : 0,
    };
    if (!coords.width || !coords.height) {
      const fallback = extractCoordinatesFromTsx(parsedJsxText, instr.component);
      if (!coords.width) coords.width = fallback.width;
      if (!coords.height) coords.height = fallback.height;
      if (!coords.x) coords.x = fallback.x;
      if (!coords.y) coords.y = fallback.y;
    }

    const resolved = await resolveComponent(instr, options.mode);

    if (resolved.node) {
      let instance: InstanceNode;
      const parentSet = resolved.node.parent;
      if (parentSet && parentSet.type === 'COMPONENT_SET') {
        const set = parentSet as ComponentSetNode;
        const seed = set.defaultVariant || resolved.node;
        instance = seed.createInstance();
        const variantProps = parseVariantPath(instr.variantPath);
        const sample = set.children[0] && (set.children[0] as any).variantProperties;
        if (sample && sample.Mode) variantProps['Mode'] = options.mode;
        try {
          if (Object.keys(variantProps).length) (instance as any).setProperties(variantProps);
        } catch (e) {
          uiLog(`    ! setProperties failed: ${(e as Error).message}`, '#fbbf24');
        }
      } else {
        instance = resolved.node.createInstance();
      }

      if (instr.props && instr.props.label) {
        await setTextContent(instance, String(instr.props.label));
      }

      frame.appendChild(instance);
      instance.x = coords.x;
      instance.y = coords.y;
      try {
        instance.resize(coords.width, coords.height);
      } catch {}

      instance.setPluginData('ds-component', instr.component);
      instance.setPluginData('ds-variant', instr.variantPath);
      instance.setPluginData('ds-node-id', instr.figmaNodeId || '');
      instance.setPluginData('ds-linked', 'true');
      instance.setPluginData('ds-match-type', resolved.matchType);

      if (resolved.matchType === 'exact-id' || resolved.matchType === 'set-variant') {
        exactMatch++;
        uiLog(`    ✓ placed at ${coords.x},${coords.y}`, '#86efac');
      } else {
        nameMatch++;
        approximate.push(instr.variantPath);
        uiLog(`    ~ name-match at ${coords.x},${coords.y}`, '#fbbf24');
      }
    } else {
      const ph = figma.createFrame();
      ph.name = `[MISSING] ${instr.component}`;
      ph.resize(Math.max(1, coords.width), Math.max(1, coords.height));
      frame.appendChild(ph);
      ph.x = coords.x;
      ph.y = coords.y;
      ph.fills = [{ type: 'SOLID', color: { r: 1, g: 0.9, b: 0.9 }, opacity: 0.7 }];
      ph.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.2, b: 0.2 } }];
      ph.strokeWeight = 1;
      ph.setPluginData('ds-missing', instr.component);
      ph.setPluginData('ds-missing-variant', instr.variantPath);
      missing.push(instr.variantPath);
      uiLog(`    ✗ missing placeholder at ${coords.x},${coords.y}`, '#fca5a5');
    }
  }

  return {
    screen: manifest.screen,
    frameNodeId: frame.id,
    total: instructions.length,
    exactMatch,
    nameMatch,
    missing,
    approximate,
    mdVersion: manifest.designMdVersion || '',
    customCount: 0,
  };
}

// ---------- Resync / Audit / Reverse ----------
async function resyncSelection() {
  const sel = figma.currentPage.selection[0];
  if (!sel || sel.type !== 'FRAME') {
    uiError('Select a frame previously built by this plugin.');
    return;
  }
  let updated = 0;
  for (const child of (sel as FrameNode).findAll(
    (n) => n.getPluginData('ds-component') !== '',
  ) as InstanceNode[]) {
    const variantPath = child.getPluginData('ds-variant');
    const component = child.getPluginData('ds-component');
    const nodeId = child.getPluginData('ds-node-id');
    if (!component) continue;
    const fakeInstr = {
      component,
      variantPath,
      figmaNodeId: nodeId,
      figmaComponentSetId: '',
      props: {},
      tokens: {},
      placement: { section: '', semanticRole: '', orderInSection: 0 },
      accessibility: { role: '' },
      globalOrder: 0,
    } as PlacementInstruction;
    const { node } = await resolveComponent(fakeInstr, 'Light');
    if (node) {
      try {
        child.swapComponent(node);
        updated++;
      } catch {}
    }
  }
  uiLog(`re-synced ${updated} instance(s)`, '#86efac');
}

function auditSelection() {
  const sel = figma.currentPage.selection[0];
  if (!sel || sel.type !== 'FRAME') {
    uiError('Select a frame previously built by this plugin.');
    return;
  }
  const items = (sel as FrameNode)
    .findAll((n) => n.getPluginData('ds-component') !== '' || n.getPluginData('ds-missing') !== '')
    .map((n) => ({
      id: n.id,
      name: n.name,
      component: n.getPluginData('ds-component') || n.getPluginData('ds-missing'),
      variantPath: n.getPluginData('ds-variant') || n.getPluginData('ds-missing-variant'),
      matchType: n.getPluginData('ds-match-type') || 'missing',
    }));
  uiLog('AUDIT REPORT:');
  uiLog(JSON.stringify(items, null, 2));
}

function reverseExport() {
  const sel = figma.currentPage.selection[0];
  if (!sel || sel.type !== 'FRAME') {
    uiError('Select a frame previously built by this plugin.');
    return;
  }
  const components = (sel as FrameNode)
    .findAll((n) => n.getPluginData('ds-component') !== '')
    .map((n, i) => ({
      component: n.getPluginData('ds-component'),
      variantPath: n.getPluginData('ds-variant'),
      figmaNodeId: n.getPluginData('ds-node-id'),
      figmaComponentSetId: '',
      props: {},
      tokens: {},
      placement: {
        section: 'Body',
        semanticRole: '',
        orderInSection: i,
        x: Math.round((n as any).x || 0),
        y: Math.round((n as any).y || 0),
        width: Math.round((n as any).width || 0),
        height: Math.round((n as any).height || 0),
      },
      accessibility: { role: '' },
    }));
  const manifest: UsageManifest = {
    screen: sel.name,
    designMdVersion: '1.0',
    viewport: { width: sel.width, height: sel.height },
    components: components as any,
    tokens: [],
    layoutTokens: [],
    missing: [],
    approximate: [],
  };
  uiLog('REVERSE EXPORT (usage.json):');
  uiLog(JSON.stringify(manifest, null, 2));
}

// ---------- Message handler ----------
figma.ui.onmessage = async (msg) => {
  const { type, payload } = msg as { type: string; payload: any };

  try {
    if (type === 'init') {
      await sendInit();
      return;
    }

    if (type === 'parse') {
      let manifest: UsageManifest;
      try {
        manifest = parseUsage(payload.usageText);
      } catch (e) {
        uiError(`usage.json invalid: ${(e as Error).message}`);
        return;
      }

      const warnings: string[] = [];
      if (manifest.designMdVersion && KNOWN_MD_VERSIONS.indexOf(manifest.designMdVersion) === -1) {
        warnings.push(
          `usage.json designMdVersion=${manifest.designMdVersion} not in known set — proceed with caution.`,
        );
      }

      parsedJsxText = payload.jsxText || '';
      const hints = parsedJsxText ? parseJsxHints(parsedJsxText) : [];
      const { instructions, warnings: w2 } = buildInstructions(manifest, hints);
      warnings.push(...w2);

      parsedManifest = manifest;
      parsedInstructions = instructions;

      const preview: any[] = [];
      const counts: Record<string, number> = {};
      for (const inst of instructions) {
        counts[inst.variantPath] = (counts[inst.variantPath] || 0) + 1;
      }
      const seen: Record<string, boolean> = {};
      for (const inst of instructions) {
        if (seen[inst.variantPath]) continue;
        seen[inst.variantPath] = true;

        let status: 'exact' | 'name' | 'missing' = 'missing';
        if (inst.figmaNodeId) {
          try {
            const n = await figma.getNodeByIdAsync(inst.figmaNodeId);
            if (n && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET')) status = 'exact';
          } catch {}
        }
        if (status === 'missing') {
          try {
            const tl = (figma as any).teamLibrary;
            if (tl && tl.getAvailableLibraryComponentsAsync) {
              const available = await tl.getAvailableLibraryComponentsAsync();
              const name = inst.component.toLowerCase();
              for (let i = 0; i < available.length; i++) {
                if (available[i].name.charAt(0) === '.') continue;
                const baseName = available[i].name.toLowerCase().split('/')[0].trim();
                if (baseName === name) { status = 'name'; break; }
              }
            }
          } catch {}
        }

        preview.push({
          component: inst.component,
          variantPath: inst.variantPath,
          figmaNodeId: inst.figmaNodeId,
          count: counts[inst.variantPath],
          status,
        });
      }

      figma.ui.postMessage({
        type: 'parsed',
        payload: { preview, warnings, customGroups: [], customCount: 0 },
      });
      return;
    }

    if (type === 'build') {
      if (!parsedManifest || !parsedInstructions.length) {
        uiError('Parse files first.');
        return;
      }
      if (!payload.screenshotBytes) {
        uiError('Screenshot PNG is required.');
        return;
      }
      const bytes =
        payload.screenshotBytes instanceof Uint8Array
          ? payload.screenshotBytes
          : new Uint8Array(payload.screenshotBytes);
      const report = await buildScreen(parsedManifest, parsedInstructions, bytes, {
        width: payload.width,
        height: payload.height,
        mode: payload.mode,
      });
      figma.ui.postMessage({ type: 'built', payload: report });
      uiLog(`done · ${report.exactMatch + report.nameMatch}/${report.total} placed`, '#86efac');
      return;
    }

    if (type === 'zoom') {
      const n = await figma.getNodeByIdAsync(payload.frameId);
      if (n && 'visible' in n) {
        figma.currentPage.selection = [n as SceneNode];
        figma.viewport.scrollAndZoomIntoView([n as SceneNode]);
      }
      return;
    }

    if (type === 'resync') { await resyncSelection(); return; }
    if (type === 'audit') { auditSelection(); return; }
    if (type === 'reverse') { reverseExport(); return; }
  } catch (e) {
    uiError((e as Error).message);
  }
};
