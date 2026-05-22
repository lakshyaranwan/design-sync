"use strict";
// Sen Money DS Mapper — main thread (screenshot + overlay approach)
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var KNOWN_MD_VERSIONS = ['1.0', '1.1', '1.2'];
// ---------- State ----------
var parsedManifest = null;
var parsedInstructions = [];
var parsedJsxText = '';
// ---------- UI ----------
figma.showUI(__html__, { width: 880, height: 640 });
function uiLog(line, color) {
    figma.ui.postMessage({ type: 'log', payload: { line: line, color: color } });
}
function uiError(message) {
    figma.ui.postMessage({ type: 'error', payload: { message: message } });
}
// ---------- Init ----------
function sendInit() {
    return __awaiter(this, void 0, void 0, function () {
        var frames, librariesConnected, libs, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    frames = figma.currentPage.children
                        .filter(function (n) { return n.type === 'FRAME'; })
                        .map(function (n) { return ({ id: n.id, name: n.name }); });
                    librariesConnected = true;
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, ((_c = (_b = figma.teamLibrary) === null || _b === void 0 ? void 0 : _b.getAvailableLibrariesAsync) === null || _c === void 0 ? void 0 : _c.call(_b))];
                case 2:
                    libs = _d.sent();
                    if (libs && Array.isArray(libs))
                        librariesConnected = libs.length > 0;
                    return [3 /*break*/, 4];
                case 3:
                    _a = _d.sent();
                    return [3 /*break*/, 4];
                case 4:
                    figma.ui.postMessage({ type: 'frames', payload: { frames: frames, librariesConnected: librariesConnected } });
                    return [2 /*return*/];
            }
        });
    });
}
// ---------- Parsing ----------
function parseUsage(text) {
    var json = JSON.parse(text);
    if (!json || typeof json !== 'object')
        throw new Error('usage.json is not an object');
    if (!Array.isArray(json.components))
        throw new Error('usage.json missing components[]');
    json.components.forEach(function (c, i) {
        if (!c.component || !c.variantPath) {
            throw new Error("components[".concat(i, "] missing component or variantPath"));
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
    var hints = [];
    var tagRegex = /<[A-Za-z][^>]*data-ds-component=["']([^"']+)["'][^>]*>/g;
    var m;
    var _loop_1 = function () {
        var tag = m[0];
        var grab = function (re) {
            var x = re.exec(tag);
            return x ? x[1] : undefined;
        };
        hints.push({
            component: m[1],
            variant: grab(/data-ds-variant=["']([^"']+)["']/),
            nodeId: grab(/data-ds-node-id=["']([^"']+)["']/),
        });
    };
    while ((m = tagRegex.exec(text)) !== null) {
        _loop_1();
    }
    return hints;
}
// Fallback: read x/y/width/height for a DS component from the TSX file
function extractCoordinatesFromTsx(tsxText, componentName) {
    var lines = tsxText.split('\n');
    var coords = { x: 0, y: 0, width: 320, height: 48 };
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('data-ds-component="' + componentName + '"') === -1)
            continue;
        var block = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join(' ');
        var left = block.match(/left[:\s]+(\d+)/);
        var top = block.match(/top[:\s]+(\d+)/);
        var w = block.match(/width[:\s]+(\d+)/);
        var h = block.match(/height[:\s]+(\d+)/);
        if (left)
            coords.x = parseInt(left[1], 10);
        if (top)
            coords.y = parseInt(top[1], 10);
        if (w)
            coords.width = parseInt(w[1], 10);
        if (h)
            coords.height = parseInt(h[1], 10);
        break;
    }
    return coords;
}
function buildInstructions(manifest, hints) {
    var e_1, _a;
    var warnings = [];
    var hintQueueByComponent = {};
    try {
        for (var hints_1 = __values(hints), hints_1_1 = hints_1.next(); !hints_1_1.done; hints_1_1 = hints_1.next()) {
            var h = hints_1_1.value;
            if (!h.component)
                continue;
            (hintQueueByComponent[h.component] = hintQueueByComponent[h.component] || []).push(h);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (hints_1_1 && !hints_1_1.done && (_a = hints_1.return)) _a.call(hints_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var enriched = manifest.components.map(function (c, i) {
        var queue = hintQueueByComponent[c.component];
        var hint = queue && queue.length ? queue.shift() : undefined;
        if (hint && hint.variant && hint.variant !== c.variantPath) {
            warnings.push("Mismatch for ".concat(c.component, ": JSX=\"").concat(hint.variant, "\" vs usage.json=\"").concat(c.variantPath, "\". Using usage.json."));
        }
        return Object.assign({}, c, {
            variantPath: c.variantPath,
            figmaNodeId: c.figmaNodeId || (hint && hint.nodeId) || '',
            globalOrder: i,
        });
    });
    return { instructions: enriched, warnings: warnings };
}
function parseVariantPath(path) {
    var segments = path.split('/').slice(1);
    var keys = ['Style', 'Size', 'Icon', 'State', 'Mode'];
    var result = {};
    keys.forEach(function (k, i) {
        if (segments[i])
            result[k] = segments[i];
    });
    return result;
}
function matchesVariantProps(node, props) {
    var vp = node.variantProperties;
    if (!vp)
        return false;
    return Object.keys(props).every(function (k) { return vp[k] === props[k]; });
}
function climbToComponentRoot(node) {
    var cur = node;
    while (cur) {
        if (cur.type === 'COMPONENT' || cur.type === 'COMPONENT_SET') {
            return { type: cur.type, node: cur };
        }
        cur = cur.parent || null;
    }
    return null;
}
function pickVariantFromSet(set, entry, mode) {
    var e_2, _a, e_3, _b;
    var variantProps = parseVariantPath(entry.variantPath);
    var sample = set.children[0] && set.children[0].variantProperties;
    if (variantProps.Mode || (sample && sample.Mode)) {
        variantProps.Mode = mode;
    }
    var exact = set.children.find(function (c) {
        return matchesVariantProps(c, variantProps);
    });
    if (exact)
        return exact;
    var best = null;
    try {
        for (var _c = __values(set.children), _d = _c.next(); !_d.done; _d = _c.next()) {
            var c = _d.value;
            var vp = c.variantProperties;
            if (!vp)
                continue;
            var score = 0;
            try {
                for (var _e = (e_3 = void 0, __values(Object.keys(variantProps))), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var k = _f.value;
                    if (vp[k] === variantProps[k])
                        score++;
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                }
                finally { if (e_3) throw e_3.error; }
            }
            if (!best || score > best.score)
                best = { node: c, score: score };
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return best ? best.node : null;
}
function resolveComponent(entry, mode) {
    return __awaiter(this, void 0, void 0, function () {
        var node, root, parent, match, match, _a, set, match, _b, tl, available, want_1, remote, imported, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!entry.figmaNodeId) return [3 /*break*/, 4];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, figma.getNodeByIdAsync(entry.figmaNodeId)];
                case 2:
                    node = _d.sent();
                    if (node) {
                        root = climbToComponentRoot(node);
                        if (root && root.type === 'COMPONENT') {
                            parent = root.node.parent;
                            if (parent && parent.type === 'COMPONENT_SET') {
                                match = pickVariantFromSet(parent, entry, mode);
                                if (match)
                                    return [2 /*return*/, { node: match, matchType: 'set-variant' }];
                            }
                            return [2 /*return*/, { node: root.node, matchType: 'exact-id' }];
                        }
                        if (root && root.type === 'COMPONENT_SET') {
                            match = pickVariantFromSet(root.node, entry, mode);
                            if (match)
                                return [2 /*return*/, { node: match, matchType: 'set-variant' }];
                        }
                    }
                    return [3 /*break*/, 4];
                case 3:
                    _a = _d.sent();
                    return [3 /*break*/, 4];
                case 4:
                    if (!entry.figmaComponentSetId) return [3 /*break*/, 8];
                    _d.label = 5;
                case 5:
                    _d.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, figma.getNodeByIdAsync(entry.figmaComponentSetId)];
                case 6:
                    set = _d.sent();
                    if (set && set.type === 'COMPONENT_SET') {
                        match = pickVariantFromSet(set, entry, mode);
                        if (match)
                            return [2 /*return*/, { node: match, matchType: 'set-variant' }];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    _b = _d.sent();
                    return [3 /*break*/, 8];
                case 8:
                    _d.trys.push([8, 12, , 13]);
                    tl = figma.teamLibrary;
                    if (!(tl && tl.getAvailableComponentsAsync)) return [3 /*break*/, 11];
                    return [4 /*yield*/, tl.getAvailableComponentsAsync()];
                case 9:
                    available = _d.sent();
                    want_1 = entry.component.toLowerCase();
                    remote = available.find(function (c) { return c.name.toLowerCase().indexOf(want_1) !== -1; });
                    if (!remote) return [3 /*break*/, 11];
                    return [4 /*yield*/, figma.importComponentByKeyAsync(remote.key)];
                case 10:
                    imported = _d.sent();
                    return [2 /*return*/, { node: imported, matchType: 'name-match' }];
                case 11: return [3 /*break*/, 13];
                case 12:
                    _c = _d.sent();
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/, { node: null, matchType: 'missing' }];
            }
        });
    });
}
// ---------- Helpers ----------
function setTextContent(instance, label) {
    return __awaiter(this, void 0, void 0, function () {
        var textNodes, t, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    textNodes = instance.findAll(function (n) { return n.type === 'TEXT'; });
                    if (textNodes.length === 0)
                        return [2 /*return*/];
                    t = textNodes[0];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, figma.loadFontAsync(t.fontName)];
                case 2:
                    _a.sent();
                    t.characters = label;
                    return [3 /*break*/, 4];
                case 3:
                    e_4 = _a.sent();
                    uiLog("  ! font load failed: ".concat(e_4.message), '#fbbf24');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ---------- Build (screenshot + overlay) ----------
function buildScreen(manifest, instructions, screenshotBytes, options) {
    return __awaiter(this, void 0, void 0, function () {
        var frame, imageHash, exactMatch, nameMatch, missing, approximate, instructions_1, instructions_1_1, instr, coords, fallback, resolved, instance, parentSet, set, seed, variantProps, sample, ph, e_5_1;
        var e_5, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    frame = figma.createFrame();
                    frame.name = manifest.screen || 'DS Mapped Screen';
                    frame.resize(options.width, options.height);
                    frame.layoutMode = 'NONE';
                    frame.clipsContent = true;
                    // 2. Place screenshot as image fill
                    try {
                        imageHash = figma.createImage(screenshotBytes).hash;
                        frame.fills = [{ type: 'IMAGE', imageHash: imageHash, scaleMode: 'FILL' }];
                    }
                    catch (e) {
                        uiLog("! screenshot fill failed: ".concat(e.message), '#fca5a5');
                    }
                    // 3. Position on canvas
                    frame.x = figma.viewport.center.x - options.width / 2;
                    frame.y = figma.viewport.center.y - options.height / 2;
                    figma.currentPage.appendChild(frame);
                    exactMatch = 0;
                    nameMatch = 0;
                    missing = [];
                    approximate = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 9, 10, 11]);
                    instructions_1 = __values(instructions), instructions_1_1 = instructions_1.next();
                    _b.label = 2;
                case 2:
                    if (!!instructions_1_1.done) return [3 /*break*/, 8];
                    instr = instructions_1_1.value;
                    uiLog("  \u2022 ".concat(instr.component, " ").concat(instr.variantPath));
                    coords = {
                        x: typeof instr.placement.x === 'number' ? instr.placement.x : 0,
                        y: typeof instr.placement.y === 'number' ? instr.placement.y : 0,
                        width: typeof instr.placement.width === 'number' ? instr.placement.width : 0,
                        height: typeof instr.placement.height === 'number' ? instr.placement.height : 0,
                    };
                    if (!coords.width || !coords.height) {
                        fallback = extractCoordinatesFromTsx(parsedJsxText, instr.component);
                        if (!coords.width)
                            coords.width = fallback.width;
                        if (!coords.height)
                            coords.height = fallback.height;
                        if (!coords.x)
                            coords.x = fallback.x;
                        if (!coords.y)
                            coords.y = fallback.y;
                    }
                    return [4 /*yield*/, resolveComponent(instr, options.mode)];
                case 3:
                    resolved = _b.sent();
                    if (!resolved.node) return [3 /*break*/, 6];
                    instance = void 0;
                    parentSet = resolved.node.parent;
                    if (parentSet && parentSet.type === 'COMPONENT_SET') {
                        set = parentSet;
                        seed = set.defaultVariant || resolved.node;
                        instance = seed.createInstance();
                        variantProps = parseVariantPath(instr.variantPath);
                        sample = set.children[0] && set.children[0].variantProperties;
                        if (sample && sample.Mode)
                            variantProps['Mode'] = options.mode;
                        try {
                            if (Object.keys(variantProps).length)
                                instance.setProperties(variantProps);
                        }
                        catch (e) {
                            uiLog("    ! setProperties failed: ".concat(e.message), '#fbbf24');
                        }
                    }
                    else {
                        instance = resolved.node.createInstance();
                    }
                    if (!(instr.props && instr.props.label)) return [3 /*break*/, 5];
                    return [4 /*yield*/, setTextContent(instance, String(instr.props.label))];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    frame.appendChild(instance);
                    instance.x = coords.x;
                    instance.y = coords.y;
                    try {
                        instance.resize(coords.width, coords.height);
                    }
                    catch (_c) { }
                    instance.setPluginData('ds-component', instr.component);
                    instance.setPluginData('ds-variant', instr.variantPath);
                    instance.setPluginData('ds-node-id', instr.figmaNodeId || '');
                    instance.setPluginData('ds-linked', 'true');
                    instance.setPluginData('ds-match-type', resolved.matchType);
                    if (resolved.matchType === 'exact-id' || resolved.matchType === 'set-variant') {
                        exactMatch++;
                        uiLog("    \u2713 placed at ".concat(coords.x, ",").concat(coords.y), '#86efac');
                    }
                    else {
                        nameMatch++;
                        approximate.push(instr.variantPath);
                        uiLog("    ~ name-match at ".concat(coords.x, ",").concat(coords.y), '#fbbf24');
                    }
                    return [3 /*break*/, 7];
                case 6:
                    ph = figma.createFrame();
                    ph.name = "[MISSING] ".concat(instr.component);
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
                    uiLog("    \u2717 missing placeholder at ".concat(coords.x, ",").concat(coords.y), '#fca5a5');
                    _b.label = 7;
                case 7:
                    instructions_1_1 = instructions_1.next();
                    return [3 /*break*/, 2];
                case 8: return [3 /*break*/, 11];
                case 9:
                    e_5_1 = _b.sent();
                    e_5 = { error: e_5_1 };
                    return [3 /*break*/, 11];
                case 10:
                    try {
                        if (instructions_1_1 && !instructions_1_1.done && (_a = instructions_1.return)) _a.call(instructions_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/, {
                        screen: manifest.screen,
                        frameNodeId: frame.id,
                        total: instructions.length,
                        exactMatch: exactMatch,
                        nameMatch: nameMatch,
                        missing: missing,
                        approximate: approximate,
                        mdVersion: manifest.designMdVersion || '',
                        customCount: 0,
                    }];
            }
        });
    });
}
// ---------- Resync / Audit / Reverse ----------
function resyncSelection() {
    return __awaiter(this, void 0, void 0, function () {
        var sel, updated, _a, _b, child, variantPath, component, nodeId, fakeInstr, node, e_6_1;
        var e_6, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    sel = figma.currentPage.selection[0];
                    if (!sel || sel.type !== 'FRAME') {
                        uiError('Select a frame previously built by this plugin.');
                        return [2 /*return*/];
                    }
                    updated = 0;
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, 7, 8]);
                    _a = __values(sel.findAll(function (n) { return n.getPluginData('ds-component') !== ''; })), _b = _a.next();
                    _d.label = 2;
                case 2:
                    if (!!_b.done) return [3 /*break*/, 5];
                    child = _b.value;
                    variantPath = child.getPluginData('ds-variant');
                    component = child.getPluginData('ds-component');
                    nodeId = child.getPluginData('ds-node-id');
                    if (!component)
                        return [3 /*break*/, 4];
                    fakeInstr = {
                        component: component,
                        variantPath: variantPath,
                        figmaNodeId: nodeId,
                        figmaComponentSetId: '',
                        props: {},
                        tokens: {},
                        placement: { section: '', semanticRole: '', orderInSection: 0 },
                        accessibility: { role: '' },
                        globalOrder: 0,
                    };
                    return [4 /*yield*/, resolveComponent(fakeInstr, 'Light')];
                case 3:
                    node = (_d.sent()).node;
                    if (node) {
                        try {
                            child.swapComponent(node);
                            updated++;
                        }
                        catch (_e) { }
                    }
                    _d.label = 4;
                case 4:
                    _b = _a.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_6_1 = _d.sent();
                    e_6 = { error: e_6_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_6) throw e_6.error; }
                    return [7 /*endfinally*/];
                case 8:
                    uiLog("re-synced ".concat(updated, " instance(s)"), '#86efac');
                    return [2 /*return*/];
            }
        });
    });
}
function auditSelection() {
    var sel = figma.currentPage.selection[0];
    if (!sel || sel.type !== 'FRAME') {
        uiError('Select a frame previously built by this plugin.');
        return;
    }
    var items = sel
        .findAll(function (n) { return n.getPluginData('ds-component') !== '' || n.getPluginData('ds-missing') !== ''; })
        .map(function (n) { return ({
        id: n.id,
        name: n.name,
        component: n.getPluginData('ds-component') || n.getPluginData('ds-missing'),
        variantPath: n.getPluginData('ds-variant') || n.getPluginData('ds-missing-variant'),
        matchType: n.getPluginData('ds-match-type') || 'missing',
    }); });
    uiLog('AUDIT REPORT:');
    uiLog(JSON.stringify(items, null, 2));
}
function reverseExport() {
    var sel = figma.currentPage.selection[0];
    if (!sel || sel.type !== 'FRAME') {
        uiError('Select a frame previously built by this plugin.');
        return;
    }
    var components = sel
        .findAll(function (n) { return n.getPluginData('ds-component') !== ''; })
        .map(function (n, i) { return ({
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
            x: Math.round(n.x || 0),
            y: Math.round(n.y || 0),
            width: Math.round(n.width || 0),
            height: Math.round(n.height || 0),
        },
        accessibility: { role: '' },
    }); });
    var manifest = {
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
figma.ui.onmessage = function (msg) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, type, payload, manifest, warnings, hints, _b, instructions, w2, preview, counts, instructions_2, instructions_2_1, inst, seen, _loop_2, instructions_3, instructions_3_1, inst, e_7_1, bytes, report, n, e_8;
    var e_9, _c, e_7, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = msg, type = _a.type, payload = _a.payload;
                _e.label = 1;
            case 1:
                _e.trys.push([1, 19, , 20]);
                if (!(type === 'init')) return [3 /*break*/, 3];
                return [4 /*yield*/, sendInit()];
            case 2:
                _e.sent();
                return [2 /*return*/];
            case 3:
                if (!(type === 'parse')) return [3 /*break*/, 12];
                manifest = void 0;
                try {
                    manifest = parseUsage(payload.usageText);
                }
                catch (e) {
                    uiError("usage.json invalid: ".concat(e.message));
                    return [2 /*return*/];
                }
                warnings = [];
                if (manifest.designMdVersion && KNOWN_MD_VERSIONS.indexOf(manifest.designMdVersion) === -1) {
                    warnings.push("usage.json designMdVersion=".concat(manifest.designMdVersion, " not in known set \u2014 proceed with caution."));
                }
                parsedJsxText = payload.jsxText || '';
                hints = parsedJsxText ? parseJsxHints(parsedJsxText) : [];
                _b = buildInstructions(manifest, hints), instructions = _b.instructions, w2 = _b.warnings;
                warnings.push.apply(warnings, __spreadArray([], __read(w2), false));
                parsedManifest = manifest;
                parsedInstructions = instructions;
                preview = [];
                counts = {};
                try {
                    for (instructions_2 = __values(instructions), instructions_2_1 = instructions_2.next(); !instructions_2_1.done; instructions_2_1 = instructions_2.next()) {
                        inst = instructions_2_1.value;
                        counts[inst.variantPath] = (counts[inst.variantPath] || 0) + 1;
                    }
                }
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (instructions_2_1 && !instructions_2_1.done && (_c = instructions_2.return)) _c.call(instructions_2);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
                seen = {};
                _loop_2 = function (inst) {
                    var status, n, _f, tl, available, _g;
                    return __generator(this, function (_h) {
                        switch (_h.label) {
                            case 0:
                                if (seen[inst.variantPath])
                                    return [2 /*return*/, "continue"];
                                seen[inst.variantPath] = true;
                                status = 'missing';
                                if (!inst.figmaNodeId) return [3 /*break*/, 4];
                                _h.label = 1;
                            case 1:
                                _h.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, figma.getNodeByIdAsync(inst.figmaNodeId)];
                            case 2:
                                n = _h.sent();
                                if (n && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'))
                                    status = 'exact';
                                return [3 /*break*/, 4];
                            case 3:
                                _f = _h.sent();
                                return [3 /*break*/, 4];
                            case 4:
                                if (!(status === 'missing')) return [3 /*break*/, 9];
                                _h.label = 5;
                            case 5:
                                _h.trys.push([5, 8, , 9]);
                                tl = figma.teamLibrary;
                                if (!(tl && tl.getAvailableComponentsAsync)) return [3 /*break*/, 7];
                                return [4 /*yield*/, tl.getAvailableComponentsAsync()];
                            case 6:
                                available = _h.sent();
                                if (available.find(function (c) {
                                    return c.name.toLowerCase().indexOf(inst.component.toLowerCase()) !== -1;
                                })) {
                                    status = 'name';
                                }
                                _h.label = 7;
                            case 7: return [3 /*break*/, 9];
                            case 8:
                                _g = _h.sent();
                                return [3 /*break*/, 9];
                            case 9:
                                preview.push({
                                    component: inst.component,
                                    variantPath: inst.variantPath,
                                    figmaNodeId: inst.figmaNodeId,
                                    count: counts[inst.variantPath],
                                    status: status,
                                });
                                return [2 /*return*/];
                        }
                    });
                };
                _e.label = 4;
            case 4:
                _e.trys.push([4, 9, 10, 11]);
                instructions_3 = __values(instructions), instructions_3_1 = instructions_3.next();
                _e.label = 5;
            case 5:
                if (!!instructions_3_1.done) return [3 /*break*/, 8];
                inst = instructions_3_1.value;
                return [5 /*yield**/, _loop_2(inst)];
            case 6:
                _e.sent();
                _e.label = 7;
            case 7:
                instructions_3_1 = instructions_3.next();
                return [3 /*break*/, 5];
            case 8: return [3 /*break*/, 11];
            case 9:
                e_7_1 = _e.sent();
                e_7 = { error: e_7_1 };
                return [3 /*break*/, 11];
            case 10:
                try {
                    if (instructions_3_1 && !instructions_3_1.done && (_d = instructions_3.return)) _d.call(instructions_3);
                }
                finally { if (e_7) throw e_7.error; }
                return [7 /*endfinally*/];
            case 11:
                figma.ui.postMessage({
                    type: 'parsed',
                    payload: { preview: preview, warnings: warnings, customGroups: [], customCount: 0 },
                });
                return [2 /*return*/];
            case 12:
                if (!(type === 'build')) return [3 /*break*/, 14];
                if (!parsedManifest || !parsedInstructions.length) {
                    uiError('Parse files first.');
                    return [2 /*return*/];
                }
                if (!payload.screenshotBytes) {
                    uiError('Screenshot PNG is required.');
                    return [2 /*return*/];
                }
                bytes = payload.screenshotBytes instanceof Uint8Array
                    ? payload.screenshotBytes
                    : new Uint8Array(payload.screenshotBytes);
                return [4 /*yield*/, buildScreen(parsedManifest, parsedInstructions, bytes, {
                        width: payload.width,
                        height: payload.height,
                        mode: payload.mode,
                    })];
            case 13:
                report = _e.sent();
                figma.ui.postMessage({ type: 'built', payload: report });
                uiLog("done \u00B7 ".concat(report.exactMatch + report.nameMatch, "/").concat(report.total, " placed"), '#86efac');
                return [2 /*return*/];
            case 14:
                if (!(type === 'zoom')) return [3 /*break*/, 16];
                return [4 /*yield*/, figma.getNodeByIdAsync(payload.frameId)];
            case 15:
                n = _e.sent();
                if (n && 'visible' in n) {
                    figma.currentPage.selection = [n];
                    figma.viewport.scrollAndZoomIntoView([n]);
                }
                return [2 /*return*/];
            case 16:
                if (!(type === 'resync')) return [3 /*break*/, 18];
                return [4 /*yield*/, resyncSelection()];
            case 17:
                _e.sent();
                return [2 /*return*/];
            case 18:
                if (type === 'audit') {
                    auditSelection();
                    return [2 /*return*/];
                }
                if (type === 'reverse') {
                    reverseExport();
                    return [2 /*return*/];
                }
                return [3 /*break*/, 20];
            case 19:
                e_8 = _e.sent();
                uiError(e_8.message);
                return [3 /*break*/, 20];
            case 20: return [2 /*return*/];
        }
    });
}); };
