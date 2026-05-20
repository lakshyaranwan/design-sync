// Sen Money DS Mapper — main thread
// Compiled with `tsc` to ./code.js (referenced by manifest.json)

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
  mdVersion: string;
}

// Known section ordering for SM screens — falls back to first-seen order
const SECTION_ORDER = [
  'Header',
  'AccountSummary',
  'TransferForm',
  'RecipientDetails',
  'Body',
  'Content',
  'StickyFooter',
];

// Known designMdVersions this plugin understands
const KNOWN_MD_VERSIONS = ['1.0', '1.1', '1.2'];

// ---------- State ----------
let parsedManifest: UsageManifest | null = null;
let parsedInstructions: PlacementInstruction[] = [];

// ---------- UI ----------
figma.showUI(__html__, { width: 880, height: 620 });

function uiLog(line: string, color?: string) {
  figma.ui.postMessage({ type: 'log', payload: { line, color } });
}
function uiError(message: string) {
  figma.ui.postMessage({ type: 'error', payload: { message } });
}

// ---------- Init: list frames & check libraries ----------
async function sendInit() {
  const frames = figma.currentPage.children
    .filter((n) => n.type === 'FRAME')
    .map((n) => ({ id: n.id, name: n.name }));

  let librariesConnected = true;
  try {
    const libs = await (figma as any).teamLibrary?.getAvailableLibrariesAsync?.();
    if (libs && Array.isArray(libs)) librariesConnected = libs.length > 0;
  } catch {
    // Older API — assume connected, will surface during lookup
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
  section?: string;
  widthHint?: number;
  heightHint?: number;
}

function parseJsxHints(text: string): { hints: JsxHint[]; sections: string[] } {
  const hints: JsxHint[] = [];
  const sections: string[] = [];

  // Section comments: // Section: X   or  {/* Section: X */}  or {/* X */}
  const sectionRegex = /(?:\/\/\s*Section:\s*([A-Za-z0-9_-]+))|(?:\{\s*\/\*\s*(?:Section:\s*)?([A-Za-z0-9_-]+)\s*\*\/\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(text)) !== null) {
    const s = m[1] || m[2];
    if (s) sections.push(s);
  }

  // Scan element-by-element: find data-ds-component attrs and pull sibling attrs in same tag
  const tagRegex = /<[A-Za-z][^>]*data-ds-component=["']([^"']+)["'][^>]*>/g;
  while ((m = tagRegex.exec(text)) !== null) {
    const tag = m[0];
    const grab = (re: RegExp) => {
      const x = re.exec(tag);
      return x ? x[1] : undefined;
    };
    const widthStr = grab(/width\s*:\s*['"]?(\d+)/);
    const heightStr = grab(/height\s*:\s*['"]?(\d+)/);
    hints.push({
      component: m[1],
      variant: grab(/data-ds-variant=["']([^"']+)["']/),
      nodeId: grab(/data-ds-node-id=["']([^"']+)["']/),
      widthHint: widthStr ? Number(widthStr) : undefined,
      heightHint: heightStr ? Number(heightStr) : undefined,
    });
  }

  return { hints, sections };
}

function buildInstructions(
  manifest: UsageManifest,
  hints: JsxHint[],
): { instructions: PlacementInstruction[]; warnings: string[] } {
  const warnings: string[] = [];

  // Merge JSX hints by component+order (best-effort by index sequence within component)
  const hintQueueByComponent: Record<string, JsxHint[]> = {};
  for (const h of hints) {
    if (!h.component) continue;
    (hintQueueByComponent[h.component] ||= []).push(h);
  }

  const enriched: PlacementInstruction[] = manifest.components.map((c, i) => {
    const queue = hintQueueByComponent[c.component];
    const hint = queue && queue.length ? queue.shift() : undefined;

    let variantPath = c.variantPath;
    if (hint?.variant && hint.variant !== c.variantPath) {
      warnings.push(
        `JSX data-ds-variant "${hint.variant}" overrides usage.json "${c.variantPath}" for ${c.component}`,
      );
      variantPath = hint.variant;
    }
    const figmaNodeId = hint?.nodeId || c.figmaNodeId;

    return {
      ...c,
      variantPath,
      figmaNodeId,
      widthHint: hint?.widthHint,
      heightHint: hint?.heightHint,
      globalOrder: i,
    };
  });

  // Stable sort: section-known-order, then orderInSection
  enriched.sort((a, b) => {
    const sa = SECTION_ORDER.indexOf(a.placement.section);
    const sb = SECTION_ORDER.indexOf(b.placement.section);
    const ai = sa === -1 ? 999 + a.globalOrder : sa;
    const bi = sb === -1 ? 999 + b.globalOrder : sb;
    if (ai !== bi) return ai - bi;
    return a.placement.orderInSection - b.placement.orderInSection;
  });
  enriched.forEach((e, i) => (e.globalOrder = i));

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

function matchesVariantProps(
  node: ComponentNode,
  props: Record<string, string>,
): boolean {
  const vp = (node as any).variantProperties as Record<string, string> | null;
  if (!vp) return false;
  return Object.keys(props).every((k) => vp[k] === props[k]);
}

async function resolveComponent(
  entry: PlacementInstruction,
  mode: 'Light' | 'Dark',
): Promise<{ node: ComponentNode | null; matchType: MatchType }> {
  // 1. Exact node ID
  if (entry.figmaNodeId) {
    try {
      const node = await figma.getNodeByIdAsync(entry.figmaNodeId);
      if (node && node.type === 'COMPONENT') {
        return { node: node as ComponentNode, matchType: 'exact-id' };
      }
    } catch {}
  }

  // 2. Component set + variant resolve
  if (entry.figmaComponentSetId) {
    try {
      const set = await figma.getNodeByIdAsync(entry.figmaComponentSetId);
      if (set && set.type === 'COMPONENT_SET') {
        const variantProps = parseVariantPath(entry.variantPath);
        // Apply mode override from UI selector
        if (variantProps.Mode) variantProps.Mode = mode;
        const match = (set.children as ComponentNode[]).find((c) =>
          matchesVariantProps(c, variantProps),
        );
        if (match) return { node: match, matchType: 'set-variant' };
      }
    } catch {}
  }

  // 3. Remote library by name
  try {
    const tl = (figma as any).teamLibrary;
    if (tl?.getAvailableComponentsAsync) {
      const available = await tl.getAvailableComponentsAsync();
      const want = entry.component.toLowerCase();
      const remote = available.find((c: any) => c.name.toLowerCase().includes(want));
      if (remote) {
        const imported = await figma.importComponentByKeyAsync(remote.key);
        return { node: imported, matchType: 'name-match' };
      }
    }
  } catch {}

  return { node: null, matchType: 'missing' };
}

// ---------- Helpers: apply props + text ----------
const VARIANT_PROP_MAP: Record<string, string> = {
  style: 'Style',
  size: 'Size',
  mode: 'Mode',
  state: 'State',
  icon: 'Icon',
};

function applyProps(
  instance: InstanceNode,
  props: Record<string, any>,
  mode: 'Light' | 'Dark',
) {
  const overrides: Record<string, string> = {};
  for (const k of Object.keys(props)) {
    const figmaKey = VARIANT_PROP_MAP[k.toLowerCase()];
    if (figmaKey) overrides[figmaKey] = String(props[k]);
  }
  overrides['Mode'] = mode;
  try {
    if (Object.keys(overrides).length > 0) {
      (instance as any).setProperties(overrides);
    }
  } catch (e) {
    uiLog(`  ! could not apply variant props: ${(e as Error).message}`, '#fbbf24');
  }
}

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

// ---------- Placeholder ----------
async function createMissingPlaceholder(
  instruction: PlacementInstruction,
): Promise<FrameNode> {
  const f = figma.createFrame();
  f.name = `[MISSING] ${instruction.variantPath}`;
  f.resize(instruction.widthHint ?? 320, instruction.heightHint ?? 48);
  f.fills = [{ type: 'SOLID', color: { r: 1, g: 0.95, b: 0.95 } }];
  f.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.2, b: 0.2 } }];
  f.strokeWeight = 1.5;
  f.dashPattern = [4, 4];
  f.setPluginData('ds-missing', instruction.component);
  f.setPluginData('ds-missing-variant', instruction.variantPath);

  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const label = figma.createText();
    label.fontName = { family: 'Inter', style: 'Regular' };
    label.characters = `${instruction.component} · ${instruction.variantPath}`;
    label.fontSize = 11;
    label.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.1, b: 0.1 } }];
    label.x = 8;
    label.y = 8;
    f.appendChild(label);
  } catch {}

  return f;
}

// ---------- Build ----------
async function buildScreen(
  manifest: UsageManifest,
  instructions: PlacementInstruction[],
  targetFrame: FrameNode | null,
  options: { width: number; height: number; mode: 'Light' | 'Dark' },
): Promise<BuildReport> {
  // Split into multiple frames if height limit exceeded
  const MAX_HEIGHT = 10000;

  const frame = targetFrame ?? figma.createFrame();
  frame.name = manifest.screen || 'DS Mapped Screen';
  frame.resize(options.width, Math.min(options.height, MAX_HEIGHT));
  frame.layoutMode = 'VERTICAL';
  frame.counterAxisSizingMode = 'FIXED';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.itemSpacing = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  let currentSection = '';
  let sectionFrame: FrameNode | null = null;

  let exactMatch = 0;
  let nameMatch = 0;
  const missing: string[] = [];
  const approximate: string[] = [];

  for (const instr of instructions) {
    if (instr.placement.section !== currentSection) {
      currentSection = instr.placement.section;
      sectionFrame = figma.createFrame();
      sectionFrame.name = currentSection;
      sectionFrame.layoutMode = 'VERTICAL';
      sectionFrame.counterAxisSizingMode = 'FIXED';
      sectionFrame.primaryAxisSizingMode = 'AUTO';
      sectionFrame.layoutSizingHorizontal = 'FILL';
      sectionFrame.fills = [];
      if (currentSection === 'StickyFooter') {
        sectionFrame.paddingTop = 20;
        sectionFrame.paddingBottom = 20;
        sectionFrame.paddingLeft = 20;
        sectionFrame.paddingRight = 20;
        sectionFrame.itemSpacing = 20;
      }
      frame.appendChild(sectionFrame);
      uiLog(`▸ section: ${currentSection}`, '#93c5fd');
    }

    uiLog(`  • ${instr.component} ${instr.variantPath}`);

    const { node, matchType } = await resolveComponent(instr, options.mode);

    if (node && sectionFrame) {
      const instance = node.createInstance();
      applyProps(instance, instr.props, options.mode);
      if (instr.props && instr.props.label) {
        await setTextContent(instance, String(instr.props.label));
      }

      instance.setPluginData('ds-component', instr.component);
      instance.setPluginData('ds-variant', instr.variantPath);
      instance.setPluginData('ds-node-id', instr.figmaNodeId || '');
      instance.setPluginData('ds-section', instr.placement.section);
      instance.setPluginData('ds-order', String(instr.globalOrder));
      instance.setPluginData('ds-match-type', matchType);
      instance.setPluginData('ds-md-version', manifest.designMdVersion || '');

      try {
        instance.layoutSizingHorizontal = 'FILL';
      } catch {}

      sectionFrame.appendChild(instance);

      if (matchType === 'exact-id' || matchType === 'set-variant') {
        exactMatch++;
        uiLog(`    ✓ ${matchType}`, '#86efac');
      } else if (matchType === 'name-match') {
        nameMatch++;
        approximate.push(instr.variantPath);
        uiLog(`    ~ name-match`, '#fbbf24');
      }
    } else if (sectionFrame) {
      const ph = await createMissingPlaceholder(instr);
      try {
        ph.layoutSizingHorizontal = 'FILL';
      } catch {}
      sectionFrame.appendChild(ph);
      missing.push(instr.variantPath);
      uiLog(`    ✗ missing → placeholder`, '#fca5a5');
    }
  }

  if (!targetFrame) {
    frame.x = figma.viewport.center.x - options.width / 2;
    frame.y = figma.viewport.center.y - options.height / 2;
    figma.currentPage.appendChild(frame);
  }

  // Split if too tall
  if ((frame.height ?? 0) > MAX_HEIGHT) {
    uiLog(`! frame height ${Math.round(frame.height)} > ${MAX_HEIGHT}, splitting`, '#fbbf24');
    splitFrame(frame, MAX_HEIGHT);
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
  };
}

function splitFrame(frame: FrameNode, maxHeight: number) {
  // Best-effort: clone overflowing children into _part2, _part3 frames
  let part = 2;
  let yAccum = 0;
  let overflowChildren: SceneNode[] = [];
  for (const child of [...frame.children]) {
    yAccum += (child as any).height || 0;
    if (yAccum > maxHeight) overflowChildren.push(child);
  }
  while (overflowChildren.length) {
    const next = frame.clone();
    next.name = frame.name + `_part${part++}`;
    // Remove all children, then re-append overflow batch
    for (const c of [...next.children]) c.remove();
    let h = 0;
    const taken: SceneNode[] = [];
    while (overflowChildren.length && h < maxHeight) {
      const c = overflowChildren.shift()!;
      h += (c as any).height || 0;
      next.appendChild(c);
      taken.push(c);
    }
    next.x = frame.x + frame.width + 80 * (part - 2);
    next.y = frame.y;
    figma.currentPage.appendChild(next);
  }
}

// ---------- Re-sync / Audit / Reverse export ----------
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
      placement: { section: child.getPluginData('ds-section'), semanticRole: '', orderInSection: 0 },
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
      mdVersion: n.getPluginData('ds-md-version'),
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
        section: n.getPluginData('ds-section') || 'Body',
        semanticRole: '',
        orderInSection: Number(n.getPluginData('ds-order')) || i,
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
      if (manifest.designMdVersion && !KNOWN_MD_VERSIONS.includes(manifest.designMdVersion)) {
        warnings.push(
          `This usage.json was generated from Design MD v${manifest.designMdVersion}. Current spec may differ — verify missing/approximate components.`,
        );
      }

      const { hints } = payload.jsxText ? parseJsxHints(payload.jsxText) : { hints: [] };
      const { instructions, warnings: w2 } = buildInstructions(manifest, hints);
      warnings.push(...w2);

      parsedManifest = manifest;
      parsedInstructions = instructions;

      // Build preview rows with quick (non-importing) match check
      const preview: any[] = [];
      const counts: Record<string, number> = {};
      for (const inst of instructions) {
        counts[inst.variantPath] = (counts[inst.variantPath] || 0) + 1;
      }
      const seen = new Set<string>();
      for (const inst of instructions) {
        if (seen.has(inst.variantPath)) continue;
        seen.add(inst.variantPath);

        let status: 'exact' | 'name' | 'missing' = 'missing';
        if (inst.figmaNodeId) {
          try {
            const n = await figma.getNodeByIdAsync(inst.figmaNodeId);
            if (n && n.type === 'COMPONENT') status = 'exact';
          } catch {}
        }
        if (status === 'missing') {
          try {
            const tl = (figma as any).teamLibrary;
            if (tl?.getAvailableComponentsAsync) {
              const available = await tl.getAvailableComponentsAsync();
              if (
                available.find((c: any) =>
                  c.name.toLowerCase().includes(inst.component.toLowerCase()),
                )
              ) {
                status = 'name';
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
        payload: { preview, warnings },
      });
      return;
    }

    if (type === 'build') {
      if (!parsedManifest || !parsedInstructions.length) {
        uiError('Parse a usage.json first.');
        return;
      }
      let target: FrameNode | null = null;
      if (payload.targetFrameId && payload.targetFrameId !== '__new__') {
        const n = await figma.getNodeByIdAsync(payload.targetFrameId);
        if (n && n.type === 'FRAME') target = n as FrameNode;
      }
      const report = await buildScreen(parsedManifest, parsedInstructions, target, {
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

    if (type === 'resync') {
      await resyncSelection();
      return;
    }
    if (type === 'audit') {
      auditSelection();
      return;
    }
    if (type === 'reverse') {
      reverseExport();
      return;
    }
  } catch (e) {
    uiError((e as Error).message);
  }
};
