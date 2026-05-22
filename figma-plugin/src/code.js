"use strict";
// Sen Money DS Mapper — main thread
// Compiled with `tsc` to ./code.js (referenced by manifest.json)
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
let parsedManifest = null;
let parsedInstructions = [];
let parsedCustomInstructions = [];
// ---------- UI ----------
figma.showUI(__html__, { width: 880, height: 620 });
function uiLog(line, color) {
    figma.ui.postMessage({ type: 'log', payload: { line, color } });
}
function uiError(message) {
    figma.ui.postMessage({ type: 'error', payload: { message } });
}
// ---------- Init: list frames & check libraries ----------
async function sendInit() {
    var _a, _b;
    const frames = figma.currentPage.children
        .filter((n) => n.type === 'FRAME')
        .map((n) => ({ id: n.id, name: n.name }));
    let librariesConnected = true;
    try {
        const libs = await ((_b = (_a = figma.teamLibrary) === null || _a === void 0 ? void 0 : _a.getAvailableLibrariesAsync) === null || _b === void 0 ? void 0 : _b.call(_a));
        if (libs && Array.isArray(libs))
            librariesConnected = libs.length > 0;
    }
    catch (_c) {
        // Older API — assume connected, will surface during lookup
    }
    figma.ui.postMessage({ type: 'frames', payload: { frames, librariesConnected } });
}
// ---------- Parsing ----------
function parseUsage(text) {
    const json = JSON.parse(text);
    if (!json || typeof json !== 'object')
        throw new Error('usage.json is not an object');
    if (!Array.isArray(json.components))
        throw new Error('usage.json missing components[]');
    json.components.forEach((c, i) => {
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
    return json;
}
function parseJsxHints(text) {
    const hints = [];
    const sections = [];
    // Section comments: // Section: X   or  {/* Section: X */}  or {/* X */}
    const sectionRegex = /(?:\/\/\s*Section:\s*([A-Za-z0-9_-]+))|(?:\{\s*\/\*\s*(?:Section:\s*)?([A-Za-z0-9_-]+)\s*\*\/\s*\})/g;
    let m;
    while ((m = sectionRegex.exec(text)) !== null) {
        const s = m[1] || m[2];
        if (s)
            sections.push(s);
    }
    // Scan element-by-element: find data-ds-component attrs and pull sibling attrs in same tag
    const tagRegex = /<[A-Za-z][^>]*data-ds-component=["']([^"']+)["'][^>]*>/g;
    while ((m = tagRegex.exec(text)) !== null) {
        const tag = m[0];
        const grab = (re) => {
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
function buildInstructions(manifest, hints) {
    var _a;
    const warnings = [];
    // Merge JSX hints by component+order (best-effort by index sequence within component)
    const hintQueueByComponent = {};
    for (const h of hints) {
        if (!h.component)
            continue;
        (hintQueueByComponent[_a = h.component] || (hintQueueByComponent[_a] = [])).push(h);
    }
    // Contract: usage.json is the SINGLE SOURCE OF TRUTH for variantPath and
    // figmaNodeId. JSX data-ds-* attributes are diagnostic only — when they
    // disagree, that indicates an upstream generator bug (the JSX and manifest
    // were produced inconsistently). We surface the mismatch but DO NOT override.
    const enriched = manifest.components.map((c, i) => {
        const queue = hintQueueByComponent[c.component];
        const hint = queue && queue.length ? queue.shift() : undefined;
        if ((hint === null || hint === void 0 ? void 0 : hint.variant) && hint.variant !== c.variantPath) {
            warnings.push(`Mismatch for ${c.component}: JSX data-ds-variant="${hint.variant}" vs usage.json "${c.variantPath}". Using usage.json. Fix the upstream generator so both files agree.`);
        }
        if ((hint === null || hint === void 0 ? void 0 : hint.nodeId) && c.figmaNodeId && hint.nodeId !== c.figmaNodeId) {
            warnings.push(`Mismatch for ${c.component}: JSX data-ds-node-id="${hint.nodeId}" vs usage.json "${c.figmaNodeId}". Using usage.json.`);
        }
        return Object.assign(Object.assign({}, c), { 
            // Always trust usage.json; fall back to JSX hint only when usage.json is empty.
            variantPath: c.variantPath, figmaNodeId: c.figmaNodeId || (hint === null || hint === void 0 ? void 0 : hint.nodeId) || '', widthHint: hint === null || hint === void 0 ? void 0 : hint.widthHint, heightHint: hint === null || hint === void 0 ? void 0 : hint.heightHint, globalOrder: i });
    });
    // Stable sort: section-known-order, then orderInSection
    enriched.sort((a, b) => {
        const sa = SECTION_ORDER.indexOf(a.placement.section);
        const sb = SECTION_ORDER.indexOf(b.placement.section);
        const ai = sa === -1 ? 999 + a.globalOrder : sa;
        const bi = sb === -1 ? 999 + b.globalOrder : sb;
        if (ai !== bi)
            return ai - bi;
        return a.placement.orderInSection - b.placement.orderInSection;
    });
    enriched.forEach((e, i) => (e.globalOrder = i));
    return { instructions: enriched, warnings };
}
function parseVariantPath(path) {
    const segments = path.split('/').slice(1);
    const keys = ['Style', 'Size', 'Icon', 'State', 'Mode'];
    const result = {};
    keys.forEach((k, i) => {
        if (segments[i])
            result[k] = segments[i];
    });
    return result;
}
function matchesVariantProps(node, props) {
    const vp = node.variantProperties;
    if (!vp)
        return false;
    return Object.keys(props).every((k) => vp[k] === props[k]);
}
function climbToComponentRoot(node) {
    var _a;
    let cur = node;
    while (cur) {
        if (cur.type === 'COMPONENT' || cur.type === 'COMPONENT_SET') {
            return { type: cur.type, node: cur };
        }
        cur = (_a = cur.parent) !== null && _a !== void 0 ? _a : null;
    }
    return null;
}
function pickVariantFromSet(set, entry, mode) {
    var _a, _b, _c;
    const variantProps = parseVariantPath(entry.variantPath);
    if (variantProps.Mode || ((_b = (_a = set.children[0]) === null || _a === void 0 ? void 0 : _a.variantProperties) === null || _b === void 0 ? void 0 : _b.Mode)) {
        variantProps.Mode = mode;
    }
    const exact = set.children.find((c) => matchesVariantProps(c, variantProps));
    if (exact)
        return exact;
    // Partial match: highest overlap of variant keys
    let best = null;
    for (const c of set.children) {
        const vp = c.variantProperties;
        if (!vp)
            continue;
        let score = 0;
        for (const k of Object.keys(variantProps))
            if (vp[k] === variantProps[k])
                score++;
        if (!best || score > best.score)
            best = { node: c, score };
    }
    return (_c = best === null || best === void 0 ? void 0 : best.node) !== null && _c !== void 0 ? _c : null;
}
async function resolveComponent(entry, mode) {
    // 1. Exact node ID — but if it points INSIDE a component (an inner layer),
    // climb up to the enclosing COMPONENT / COMPONENT_SET so we instantiate the
    // top-level component, not a nested frame/text/instance.
    if (entry.figmaNodeId) {
        try {
            const node = await figma.getNodeByIdAsync(entry.figmaNodeId);
            if (node) {
                const root = climbToComponentRoot(node);
                if ((root === null || root === void 0 ? void 0 : root.type) === 'COMPONENT') {
                    if (node.id !== root.node.id) {
                        uiLog(`    ↑ node is inside component "${root.node.name}" — using parent`, '#93c5fd');
                    }
                    const parent = root.node.parent;
                    if (parent && parent.type === 'COMPONENT_SET') {
                        const match = pickVariantFromSet(parent, entry, mode);
                        if (match)
                            return { node: match, matchType: 'set-variant' };
                    }
                    return { node: root.node, matchType: 'exact-id' };
                }
                if ((root === null || root === void 0 ? void 0 : root.type) === 'COMPONENT_SET') {
                    const match = pickVariantFromSet(root.node, entry, mode);
                    if (match) {
                        uiLog(`    ↑ node is inside set "${root.node.name}" — picked variant "${match.name}"`, '#93c5fd');
                        return { node: match, matchType: 'set-variant' };
                    }
                }
            }
        }
        catch (_a) { }
    }
    // 2. Component set + variant resolve
    if (entry.figmaComponentSetId) {
        try {
            const set = await figma.getNodeByIdAsync(entry.figmaComponentSetId);
            if (set && set.type === 'COMPONENT_SET') {
                const match = pickVariantFromSet(set, entry, mode);
                if (match)
                    return { node: match, matchType: 'set-variant' };
            }
        }
        catch (_b) { }
    }
    // 3. Remote library by name
    try {
        const tl = figma.teamLibrary;
        if (tl === null || tl === void 0 ? void 0 : tl.getAvailableComponentsAsync) {
            const available = await tl.getAvailableComponentsAsync();
            const want = entry.component.toLowerCase();
            const remote = available.find((c) => c.name.toLowerCase().includes(want));
            if (remote) {
                const imported = await figma.importComponentByKeyAsync(remote.key);
                return { node: imported, matchType: 'name-match' };
            }
        }
    }
    catch (_c) { }
    return { node: null, matchType: 'missing' };
}
// ---------- Helpers: apply props + text ----------
const VARIANT_PROP_MAP = {
    style: 'Style',
    size: 'Size',
    mode: 'Mode',
    state: 'State',
    icon: 'Icon',
};
function applyProps(instance, props, mode) {
    const overrides = {};
    for (const k of Object.keys(props)) {
        const figmaKey = VARIANT_PROP_MAP[k.toLowerCase()];
        if (figmaKey)
            overrides[figmaKey] = String(props[k]);
    }
    overrides['Mode'] = mode;
    try {
        if (Object.keys(overrides).length > 0) {
            instance.setProperties(overrides);
        }
    }
    catch (e) {
        uiLog(`  ! could not apply variant props: ${e.message}`, '#fbbf24');
    }
}
async function setTextContent(instance, label) {
    const textNodes = instance.findAll((n) => n.type === 'TEXT');
    if (textNodes.length === 0)
        return;
    const t = textNodes[0];
    try {
        await figma.loadFontAsync(t.fontName);
        t.characters = label;
    }
    catch (e) {
        uiLog(`  ! font load failed: ${e.message}`, '#fbbf24');
    }
}
// ---------- Placeholder ----------
async function createMissingPlaceholder(instruction) {
    var _a, _b;
    const f = figma.createFrame();
    f.name = `[MISSING] ${instruction.variantPath}`;
    f.resize((_a = instruction.widthHint) !== null && _a !== void 0 ? _a : 320, (_b = instruction.heightHint) !== null && _b !== void 0 ? _b : 48);
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
    }
    catch (_c) { }
    return f;
}
// ---------- Build ----------
async function buildScreen(manifest, instructions, targetFrame, options) {
    var _a, _b, _c;
    // Split into multiple frames if height limit exceeded
    const MAX_HEIGHT = 10000;
    const frame = targetFrame !== null && targetFrame !== void 0 ? targetFrame : figma.createFrame();
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
    let sectionFrame = null;
    let exactMatch = 0;
    let nameMatch = 0;
    const missing = [];
    const approximate = [];
    for (const instr of instructions) {
        if (instr.placement.section !== currentSection) {
            currentSection = instr.placement.section;
            sectionFrame = figma.createFrame();
            sectionFrame.name = currentSection;
            // Set auto-layout BEFORE appending children so FILL works on descendants.
            sectionFrame.layoutMode = 'VERTICAL';
            sectionFrame.counterAxisSizingMode = 'FIXED';
            sectionFrame.primaryAxisSizingMode = 'AUTO';
            sectionFrame.fills = [];
            if (currentSection === 'StickyFooter') {
                sectionFrame.paddingTop = 20;
                sectionFrame.paddingBottom = 20;
                sectionFrame.paddingLeft = 20;
                sectionFrame.paddingRight = 20;
                sectionFrame.itemSpacing = 20;
            }
            // Parent must be appended into its auto-layout container BEFORE we set
            // layoutSizingHorizontal — that property is only valid on children of
            // an auto-layout frame.
            frame.appendChild(sectionFrame);
            try {
                sectionFrame.layoutSizingHorizontal = 'FILL';
            }
            catch (e) {
                uiLog(`  ! section FILL failed: ${e.message}`, '#fbbf24');
            }
            uiLog(`▸ section: ${currentSection}`, '#93c5fd');
        }
        uiLog(`  • ${instr.component} ${instr.variantPath}`);
        const { node, matchType } = await resolveComponent(instr, options.mode);
        if (node && sectionFrame) {
            // Link to parent ComponentSet (so layers panel shows "Button", not
            // "Button/Primary/Large"). Instantiate from the set's default variant
            // and then apply the desired variant via setProperties.
            let instance;
            const parentSet = node.parent;
            if (parentSet && parentSet.type === 'COMPONENT_SET') {
                const set = parentSet;
                const seed = (_a = set.defaultVariant) !== null && _a !== void 0 ? _a : node;
                instance = seed.createInstance();
                const variantProps = parseVariantPath(instr.variantPath);
                const sample = (_b = set.children[0]) === null || _b === void 0 ? void 0 : _b.variantProperties;
                if (sample && sample.Mode)
                    variantProps['Mode'] = options.mode;
                try {
                    if (Object.keys(variantProps).length)
                        instance.setProperties(variantProps);
                }
                catch (e) {
                    uiLog(`    ! setProperties failed: ${e.message}`, '#fbbf24');
                }
            }
            else {
                instance = node.createInstance();
            }
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
            // Append FIRST, then set layoutSizingHorizontal (requires auto-layout parent).
            sectionFrame.appendChild(instance);
            try {
                instance.layoutSizingHorizontal = 'FILL';
            }
            catch (_d) { }
            if (matchType === 'exact-id' || matchType === 'set-variant') {
                exactMatch++;
                uiLog(`    ✓ ${matchType}`, '#86efac');
            }
            else if (matchType === 'name-match') {
                nameMatch++;
                approximate.push(instr.variantPath);
                uiLog(`    ~ name-match`, '#fbbf24');
            }
        }
        else if (sectionFrame) {
            const ph = await createMissingPlaceholder(instr);
            sectionFrame.appendChild(ph);
            try {
                ph.layoutSizingHorizontal = 'FILL';
            }
            catch (_e) { }
            missing.push(instr.variantPath);
            uiLog(`    ✗ missing → placeholder`, '#fca5a5');
        }
        // ── PASS 2: Custom (non-DS) elements parsed from TSX ────────────
        let customCount = 0;
        if (options.customInstructions && options.customInstructions.length > 0) {
            uiLog(`▸ rendering ${options.customInstructions.length} custom elements`, '#93c5fd');
            try {
                customCount = await buildCustomNodes(options.customInstructions, frame);
            }
            catch (e) {
                uiLog(`! custom node pass failed: ${e.message}`, '#fca5a5');
            }
        }
    }
    if (!targetFrame) {
        frame.x = figma.viewport.center.x - options.width / 2;
        frame.y = figma.viewport.center.y - options.height / 2;
        figma.currentPage.appendChild(frame);
    }
    // Split if too tall
    if (((_c = frame.height) !== null && _c !== void 0 ? _c : 0) > MAX_HEIGHT) {
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
        customCount,
    };
}
function splitFrame(frame, maxHeight) {
    // Best-effort: clone overflowing children into _part2, _part3 frames
    let part = 2;
    let yAccum = 0;
    let overflowChildren = [];
    for (const child of [...frame.children]) {
        yAccum += child.height || 0;
        if (yAccum > maxHeight)
            overflowChildren.push(child);
    }
    while (overflowChildren.length) {
        const next = frame.clone();
        next.name = frame.name + `_part${part++}`;
        // Remove all children, then re-append overflow batch
        for (const c of [...next.children])
            c.remove();
        let h = 0;
        const taken = [];
        while (overflowChildren.length && h < maxHeight) {
            const c = overflowChildren.shift();
            h += c.height || 0;
            next.appendChild(c);
            taken.push(c);
        }
        next.x = frame.x + frame.width + 80 * (part - 2);
        next.y = frame.y;
        figma.currentPage.appendChild(next);
    }
}
// ---------- Custom (non-DS) parser + builder ----------
function parseFullTsx(tsxText) {
    var _a, _b, _c, _d;
    const hints = [];
    const customInstructions = [];
    const sectionMap = {};
    const TOKEN_HEX = {
        'color.light.primary.500': '#1c3fcaff',
        'color.light.primary.50': '#f3f6fdff',
        'color.shade.white': '#ffffffff',
        'color.shade.black': '#030612ff',
        'color.light.neutral.50': '#f5f6fbff',
        'color.light.neutral.100': '#ecedf3ff',
        'color.light.neutral.300': '#c8cad4ff',
        'color.light.neutral.500': '#6b7280ff',
        'color.light.neutral.900': '#111827ff',
    };
    function resolveColorValue(raw) {
        var _a;
        const tokenMatch = raw.match(/tokens\[['"]([^'"]+)['"]\]/);
        if (tokenMatch)
            return (_a = TOKEN_HEX[tokenMatch[1]]) !== null && _a !== void 0 ? _a : raw;
        if (raw.startsWith('#'))
            return raw;
        if (raw.startsWith('rgb'))
            return raw;
        return raw;
    }
    function parseInlineStyles(styleStr) {
        const styles = {};
        const pairs = styleStr.matchAll(/(\w+):\s*([^,}]+)/g);
        for (const match of pairs) {
            const key = match[1];
            const rawVal = match[2];
            const val = String(rawVal).trim().replace(/['"]/g, '');
            switch (key) {
                case 'display':
                    styles.display = val;
                    break;
                case 'flexDirection':
                    styles.flexDirection = val;
                    break;
                case 'justifyContent':
                    styles.justifyContent = val;
                    break;
                case 'alignItems':
                    styles.alignItems = val;
                    break;
                case 'gap':
                    styles.gap = parseFloat(val);
                    break;
                case 'paddingTop':
                    styles.paddingTop = parseFloat(val);
                    break;
                case 'paddingBottom':
                    styles.paddingBottom = parseFloat(val);
                    break;
                case 'paddingLeft':
                    styles.paddingLeft = parseFloat(val);
                    break;
                case 'paddingRight':
                    styles.paddingRight = parseFloat(val);
                    break;
                case 'padding': {
                    const p = parseFloat(val);
                    styles.paddingTop = styles.paddingBottom = styles.paddingLeft = styles.paddingRight = p;
                    break;
                }
                case 'width':
                    styles.width = val.includes('%') ? 'fill' : parseFloat(val);
                    break;
                case 'height':
                    styles.height = val.includes('%') ? 'fill' : parseFloat(val);
                    break;
                case 'backgroundColor':
                    styles.backgroundColor = resolveColorValue(String(rawVal).trim());
                    break;
                case 'color':
                    styles.color = resolveColorValue(String(rawVal).trim());
                    break;
                case 'fontSize':
                    styles.fontSize = parseFloat(val);
                    break;
                case 'fontWeight':
                    styles.fontWeight = parseFloat(val);
                    break;
                case 'lineHeight':
                    styles.lineHeight = parseFloat(val);
                    break;
                case 'borderRadius':
                    styles.borderRadius = parseFloat(val);
                    break;
                case 'opacity':
                    styles.opacity = parseFloat(val);
                    break;
                case 'position':
                    styles.position = val;
                    break;
                case 'bottom':
                    styles.bottom = parseFloat(val);
                    break;
                case 'boxShadow':
                    styles.boxShadow = String(rawVal).trim();
                    break;
            }
        }
        return styles;
    }
    const lines = tsxText.split('\n');
    let currentSection = 'Body';
    let orderIndex = 0;
    let depth = 0;
    const depthStack = ['root'];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sectionMatch = line.match(/\{\/\*\s*Section:\s*([A-Za-z0-9_-]+)\s*\*\/\}/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            continue;
        }
        if (line.includes('data-ds-component=')) {
            const compM = line.match(/data-ds-component=["']([^"']+)["']/);
            const variantM = line.match(/data-ds-variant=["']([^"']+)["']/);
            const nodeIdM = line.match(/data-ds-node-id=["']([^"']+)["']/);
            if (compM) {
                const hint = { component: compM[1] };
                if (variantM)
                    hint.variant = variantM[1];
                if (nodeIdM)
                    hint.nodeId = nodeIdM[1];
                hints.push(hint);
            }
            continue;
        }
        const openTagMatch = line.match(/^\s*<(div|section|main|header|footer|p|h[1-6]|span)\s/);
        if (openTagMatch) {
            const tag = openTagMatch[1];
            const id = `node-${orderIndex.toString().padStart(3, '0')}`;
            const parentId = (_a = depthStack[depthStack.length - 1]) !== null && _a !== void 0 ? _a : 'root';
            const styleMatch = line.match(/style=\{\{(.+?)(?:\}\}|$)/s);
            let styleStr = styleMatch ? styleMatch[1] : '';
            if (styleMatch && !line.includes('}}')) {
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    styleStr += ' ' + lines[j];
                    if (lines[j].includes('}}')) {
                        i = j;
                        break;
                    }
                }
            }
            const styles = parseInlineStyles(styleStr);
            let category = 'custom-frame';
            let inferredType = 'frame';
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span'].includes(tag)) {
                const textMatch = ((_b = lines[i + 1]) !== null && _b !== void 0 ? _b : '').match(/^\s*([^<{]+?)\s*$/);
                if (textMatch) {
                    category = 'custom-text';
                    inferredType = 'text';
                }
            }
            const prevLine = (_c = lines[i - 1]) !== null && _c !== void 0 ? _c : '';
            if (prevLine.includes('image:'))
                inferredType = 'image-placeholder';
            if (prevLine.includes('icon:'))
                inferredType = 'icon-placeholder';
            if (styles.height === 1 || (typeof styles.height === 'number' && styles.height <= 2)) {
                inferredType = 'divider';
            }
            const instr = {
                id,
                category,
                depth,
                parentId,
                tag,
                inferredType,
                sectionName: currentSection,
                styles,
                orderIndex: orderIndex++,
            };
            if (category === 'custom-text') {
                const textLine = (_d = lines[i + 1]) === null || _d === void 0 ? void 0 : _d.trim();
                if (textLine && !textLine.startsWith('<')) {
                    instr.textContent = textLine.replace(/[{}'"`]/g, '').trim();
                }
            }
            customInstructions.push(instr);
            depthStack.push(id);
            depth++;
        }
        if (line.match(/^\s*<\/(div|section|main|header|footer|p|h[1-6]|span)>/)) {
            if (depthStack.length > 1)
                depthStack.pop();
            depth = Math.max(0, depth - 1);
        }
    }
    return { hints, customInstructions, sectionMap };
}
function hexToRgb(hex) {
    const clean = hex.replace('#', '').replace(/ff$/i, '');
    if (clean.length === 6) {
        return {
            r: parseInt(clean.slice(0, 2), 16) / 255,
            g: parseInt(clean.slice(2, 4), 16) / 255,
            b: parseInt(clean.slice(4, 6), 16) / 255,
        };
    }
    const rgbMatch = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]) / 255,
            g: parseInt(rgbMatch[2]) / 255,
            b: parseInt(rgbMatch[3]) / 255,
        };
    }
    return null;
}
function parseBoxShadow(shadow) {
    var _a, _b;
    const m = shadow.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s*(\d+)?px?\s*rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    if (!m)
        return null;
    return {
        type: 'DROP_SHADOW',
        offset: { x: parseInt(m[1]), y: parseInt(m[2]) },
        radius: parseInt(m[3]),
        spread: parseInt((_a = m[4]) !== null && _a !== void 0 ? _a : '0'),
        color: {
            r: parseInt(m[5]) / 255,
            g: parseInt(m[6]) / 255,
            b: parseInt(m[7]) / 255,
            a: parseFloat((_b = m[8]) !== null && _b !== void 0 ? _b : '1'),
        },
        blendMode: 'NORMAL',
        showShadowBehindNode: false,
        visible: true,
    };
}
function mapJustify(val) {
    var _a;
    const map = {
        'flex-start': 'MIN', 'start': 'MIN',
        'center': 'CENTER',
        'flex-end': 'MAX', 'end': 'MAX',
        'space-between': 'SPACE_BETWEEN',
    };
    return (_a = map[val !== null && val !== void 0 ? val : 'flex-start']) !== null && _a !== void 0 ? _a : 'MIN';
}
function mapAlign(val) {
    var _a;
    const map = {
        'flex-start': 'MIN', 'start': 'MIN',
        'center': 'CENTER',
        'flex-end': 'MAX', 'end': 'MAX',
        'stretch': 'STRETCH',
    };
    return (_a = map[val !== null && val !== void 0 ? val : 'flex-start']) !== null && _a !== void 0 ? _a : 'MIN';
}
function applyFrameSizing(frame, instr, parent) {
    if (parent.layoutMode === 'NONE')
        return;
    if (instr.styles.width === 'fill' || instr.styles.width === '100%') {
        try {
            frame.layoutSizingHorizontal = 'FILL';
        }
        catch (_a) { }
    }
    else if (typeof instr.styles.width === 'number') {
        try {
            frame.layoutSizingHorizontal = 'FIXED';
        }
        catch (_b) { }
        frame.resize(instr.styles.width, frame.height || 1);
    }
    else {
        try {
            frame.layoutSizingHorizontal = 'HUG';
        }
        catch (_c) { }
    }
    if (typeof instr.styles.height === 'number') {
        try {
            frame.layoutSizingVertical = 'FIXED';
        }
        catch (_d) { }
        frame.resize(frame.width || 1, instr.styles.height);
    }
    else {
        try {
            frame.layoutSizingVertical = 'HUG';
        }
        catch (_e) { }
    }
}
function applyRectSizing(rect, instr, parent) {
    if (parent.layoutMode === 'NONE')
        return;
    if (instr.styles.width === 'fill' || instr.styles.width === '100%') {
        try {
            rect.layoutSizingHorizontal = 'FILL';
        }
        catch (_a) { }
    }
}
async function buildCustomNodes(instructions, rootFrame) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const nodeMap = new Map();
    nodeMap.set('root', rootFrame);
    let count = 0;
    function getSectionFrame(sectionName) {
        for (const child of rootFrame.children) {
            if (child.name === sectionName && child.type === 'FRAME')
                return child;
        }
        const sf = figma.createFrame();
        sf.name = sectionName;
        sf.layoutMode = 'VERTICAL';
        sf.counterAxisSizingMode = 'FIXED';
        sf.primaryAxisSizingMode = 'AUTO';
        sf.fills = [];
        rootFrame.appendChild(sf);
        try {
            sf.layoutSizingHorizontal = 'FILL';
        }
        catch (_a) { }
        return sf;
    }
    for (const instr of instructions) {
        const parentNode = (_b = nodeMap.get((_a = instr.parentId) !== null && _a !== void 0 ? _a : 'root')) !== null && _b !== void 0 ? _b : getSectionFrame((_c = instr.sectionName) !== null && _c !== void 0 ? _c : 'Body');
        let created = null;
        try {
            if (instr.category === 'custom-text') {
                const t = figma.createText();
                const weight = (_d = instr.styles.fontWeight) !== null && _d !== void 0 ? _d : 400;
                const style = weight >= 700 ? 'Bold' : weight >= 600 ? 'SemiBold' : weight >= 500 ? 'Medium' : 'Regular';
                try {
                    await figma.loadFontAsync({ family: 'Inter', style });
                }
                catch (_k) {
                    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
                }
                t.fontName = { family: 'Inter', style };
                t.characters = (_e = instr.textContent) !== null && _e !== void 0 ? _e : '';
                if (instr.styles.fontSize)
                    t.fontSize = instr.styles.fontSize;
                if (instr.styles.lineHeight)
                    t.lineHeight = { value: instr.styles.lineHeight, unit: 'PIXELS' };
                if (instr.styles.color) {
                    const col = hexToRgb(instr.styles.color);
                    if (col)
                        t.fills = [{ type: 'SOLID', color: col }];
                }
                t.setPluginData('ds-linked', 'false');
                t.setPluginData('ds-custom-type', 'text');
                parentNode.appendChild(t);
                created = t;
            }
            else if (instr.inferredType === 'image-placeholder' ||
                instr.inferredType === 'icon-placeholder' ||
                instr.inferredType === 'divider') {
                const r = figma.createRectangle();
                r.name = instr.inferredType === 'divider'
                    ? '[divider]'
                    : `[${instr.inferredType}] ${(_f = instr.className) !== null && _f !== void 0 ? _f : ''}`;
                const w = typeof instr.styles.width === 'number' ? instr.styles.width : 40;
                const h = typeof instr.styles.height === 'number' ? instr.styles.height : 40;
                r.resize(Math.max(1, w), Math.max(1, h));
                if (instr.styles.backgroundColor) {
                    const col = hexToRgb(instr.styles.backgroundColor);
                    if (col)
                        r.fills = [{ type: 'SOLID', color: col }];
                }
                if (instr.styles.borderRadius)
                    r.cornerRadius = instr.styles.borderRadius;
                r.setPluginData('ds-linked', 'false');
                r.setPluginData('ds-custom-type', (_g = instr.inferredType) !== null && _g !== void 0 ? _g : 'rect');
                parentNode.appendChild(r);
                applyRectSizing(r, instr, parentNode);
                created = r;
            }
            else {
                const f = figma.createFrame();
                f.name = (_j = (_h = instr.className) !== null && _h !== void 0 ? _h : instr.tag) !== null && _j !== void 0 ? _j : 'frame';
                f.fills = [];
                if (instr.styles.display === 'flex') {
                    f.layoutMode = instr.styles.flexDirection === 'row' ? 'HORIZONTAL' : 'VERTICAL';
                    f.primaryAxisSizingMode = 'AUTO';
                    f.counterAxisSizingMode = 'AUTO';
                    if (instr.styles.gap)
                        f.itemSpacing = instr.styles.gap;
                    if (instr.styles.paddingTop)
                        f.paddingTop = instr.styles.paddingTop;
                    if (instr.styles.paddingBottom)
                        f.paddingBottom = instr.styles.paddingBottom;
                    if (instr.styles.paddingLeft)
                        f.paddingLeft = instr.styles.paddingLeft;
                    if (instr.styles.paddingRight)
                        f.paddingRight = instr.styles.paddingRight;
                    f.primaryAxisAlignItems = mapJustify(instr.styles.justifyContent);
                    f.counterAxisAlignItems = mapAlign(instr.styles.alignItems);
                }
                else {
                    f.layoutMode = 'NONE';
                }
                if (instr.styles.backgroundColor) {
                    const col = hexToRgb(instr.styles.backgroundColor);
                    if (col)
                        f.fills = [{ type: 'SOLID', color: col }];
                }
                if (instr.styles.borderRadius)
                    f.cornerRadius = instr.styles.borderRadius;
                if (instr.styles.opacity !== undefined)
                    f.opacity = instr.styles.opacity;
                if (instr.styles.boxShadow) {
                    const shadow = parseBoxShadow(instr.styles.boxShadow);
                    if (shadow)
                        f.effects = [shadow];
                }
                if (instr.styles.position === 'sticky' || instr.styles.position === 'fixed') {
                    f.name = '[sticky] ' + f.name;
                    f.constraints = { horizontal: 'STRETCH', vertical: 'MAX' };
                }
                f.setPluginData('ds-linked', 'false');
                f.setPluginData('ds-custom-type', 'frame');
                parentNode.appendChild(f);
                applyFrameSizing(f, instr, parentNode);
                created = f;
            }
            if (created) {
                nodeMap.set(instr.id, created);
                count++;
            }
        }
        catch (e) {
            uiLog(`  ! custom node ${instr.tag} failed: ${e.message}`, '#fbbf24');
        }
    }
    return count;
}
async function resyncSelection() {
    const sel = figma.currentPage.selection[0];
    if (!sel || sel.type !== 'FRAME') {
        uiError('Select a frame previously built by this plugin.');
        return;
    }
    let updated = 0;
    for (const child of sel.findAll((n) => n.getPluginData('ds-component') !== '')) {
        const variantPath = child.getPluginData('ds-variant');
        const component = child.getPluginData('ds-component');
        const nodeId = child.getPluginData('ds-node-id');
        if (!component)
            continue;
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
        };
        const { node } = await resolveComponent(fakeInstr, 'Light');
        if (node) {
            try {
                child.swapComponent(node);
                updated++;
            }
            catch (_a) { }
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
    const items = sel
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
    const components = sel
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
    const manifest = {
        screen: sel.name,
        designMdVersion: '1.0',
        viewport: { width: sel.width, height: sel.height },
        components: components,
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
    var _a;
    const { type, payload } = msg;
    try {
        if (type === 'init') {
            await sendInit();
            return;
        }
        if (type === 'parse') {
            let manifest;
            try {
                manifest = parseUsage(payload.usageText);
            }
            catch (e) {
                uiError(`usage.json invalid: ${e.message}`);
                return;
            }
            const warnings = [];
            if (manifest.designMdVersion && !KNOWN_MD_VERSIONS.includes(manifest.designMdVersion)) {
                warnings.push(`This usage.json was generated from Design MD v${manifest.designMdVersion}. Current spec may differ — verify missing/approximate components.`);
            }
            const parsedTsx = payload.jsxText
                ? parseFullTsx(payload.jsxText)
                : { hints: [], customInstructions: [] };
            const { hints, customInstructions } = parsedTsx;
            const { instructions, warnings: w2 } = buildInstructions(manifest, hints);
            warnings.push(...w2);
            parsedManifest = manifest;
            parsedInstructions = instructions;
            parsedCustomInstructions = customInstructions;
            // Custom element grouping for UI preview
            const customCounts = {};
            for (const ci of customInstructions) {
                const k = (_a = ci.inferredType) !== null && _a !== void 0 ? _a : ci.category;
                customCounts[k] = (customCounts[k] || 0) + 1;
            }
            const customGroups = Object.keys(customCounts).map((k) => ({
                type: k,
                count: customCounts[k],
            }));
            // Build preview rows with quick (non-importing) match check
            const preview = [];
            const counts = {};
            for (const inst of instructions) {
                counts[inst.variantPath] = (counts[inst.variantPath] || 0) + 1;
            }
            const seen = new Set();
            for (const inst of instructions) {
                if (seen.has(inst.variantPath))
                    continue;
                seen.add(inst.variantPath);
                let status = 'missing';
                if (inst.figmaNodeId) {
                    try {
                        const n = await figma.getNodeByIdAsync(inst.figmaNodeId);
                        if (n && n.type === 'COMPONENT')
                            status = 'exact';
                    }
                    catch (_b) { }
                }
                if (status === 'missing') {
                    try {
                        const tl = figma.teamLibrary;
                        if (tl === null || tl === void 0 ? void 0 : tl.getAvailableComponentsAsync) {
                            const available = await tl.getAvailableComponentsAsync();
                            if (available.find((c) => c.name.toLowerCase().includes(inst.component.toLowerCase()))) {
                                status = 'name';
                            }
                        }
                    }
                    catch (_c) { }
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
                payload: {
                    preview,
                    warnings,
                    customGroups,
                    customCount: parsedCustomInstructions.length,
                },
            });
            return;
        }
        if (type === 'build') {
            if (!parsedManifest || !parsedInstructions.length) {
                uiError('Parse a usage.json first.');
                return;
            }
            let target = null;
            if (payload.targetFrameId && payload.targetFrameId !== '__new__') {
                const n = await figma.getNodeByIdAsync(payload.targetFrameId);
                if (n && n.type === 'FRAME')
                    target = n;
            }
            const report = await buildScreen(parsedManifest, parsedInstructions, target, {
                width: payload.width,
                height: payload.height,
                mode: payload.mode,
                customInstructions: parsedCustomInstructions,
            });
            figma.ui.postMessage({ type: 'built', payload: report });
            uiLog(`done · ${report.exactMatch + report.nameMatch}/${report.total} placed`, '#86efac');
            return;
        }
        if (type === 'zoom') {
            const n = await figma.getNodeByIdAsync(payload.frameId);
            if (n && 'visible' in n) {
                figma.currentPage.selection = [n];
                figma.viewport.scrollAndZoomIntoView([n]);
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
    }
    catch (e) {
        uiError(e.message);
    }
};
