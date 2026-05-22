"use strict";
// Sen Money DS Mapper — main thread
// Compiled with `tsc` to ./code.js (referenced by manifest.json)
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
// Known section ordering for SM screens — falls back to first-seen order
var SECTION_ORDER = [
    'Header',
    'AccountSummary',
    'TransferForm',
    'RecipientDetails',
    'Body',
    'Content',
    'StickyFooter',
];
// Known designMdVersions this plugin understands
var KNOWN_MD_VERSIONS = ['1.0', '1.1', '1.2'];
// ---------- State ----------
var parsedManifest = null;
var parsedInstructions = [];
var parsedCustomInstructions = [];
// ---------- UI ----------
figma.showUI(__html__, { width: 880, height: 620 });
function uiLog(line, color) {
    figma.ui.postMessage({ type: 'log', payload: { line: line, color: color } });
}
function uiError(message) {
    figma.ui.postMessage({ type: 'error', payload: { message: message } });
}
// ---------- Init: list frames & check libraries ----------
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
    var sections = [];
    // Section comments: // Section: X   or  {/* Section: X */}  or {/* X */}
    var sectionRegex = /(?:\/\/\s*Section:\s*([A-Za-z0-9_-]+))|(?:\{\s*\/\*\s*(?:Section:\s*)?([A-Za-z0-9_-]+)\s*\*\/\s*\})/g;
    var m;
    while ((m = sectionRegex.exec(text)) !== null) {
        var s = m[1] || m[2];
        if (s)
            sections.push(s);
    }
    // Scan element-by-element: find data-ds-component attrs and pull sibling attrs in same tag
    var tagRegex = /<[A-Za-z][^>]*data-ds-component=["']([^"']+)["'][^>]*>/g;
    var _loop_1 = function () {
        var tag = m[0];
        var grab = function (re) {
            var x = re.exec(tag);
            return x ? x[1] : undefined;
        };
        var widthStr = grab(/width\s*:\s*['"]?(\d+)/);
        var heightStr = grab(/height\s*:\s*['"]?(\d+)/);
        hints.push({
            component: m[1],
            variant: grab(/data-ds-variant=["']([^"']+)["']/),
            nodeId: grab(/data-ds-node-id=["']([^"']+)["']/),
            widthHint: widthStr ? Number(widthStr) : undefined,
            heightHint: heightStr ? Number(heightStr) : undefined,
        });
    };
    while ((m = tagRegex.exec(text)) !== null) {
        _loop_1();
    }
    return { hints: hints, sections: sections };
}
function buildInstructions(manifest, hints) {
    var e_1, _a;
    var _b;
    var warnings = [];
    // Merge JSX hints by component+order (best-effort by index sequence within component)
    var hintQueueByComponent = {};
    try {
        for (var hints_1 = __values(hints), hints_1_1 = hints_1.next(); !hints_1_1.done; hints_1_1 = hints_1.next()) {
            var h = hints_1_1.value;
            if (!h.component)
                continue;
            (hintQueueByComponent[_b = h.component] || (hintQueueByComponent[_b] = [])).push(h);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (hints_1_1 && !hints_1_1.done && (_a = hints_1.return)) _a.call(hints_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // Contract: usage.json is the SINGLE SOURCE OF TRUTH for variantPath and
    // figmaNodeId. JSX data-ds-* attributes are diagnostic only — when they
    // disagree, that indicates an upstream generator bug (the JSX and manifest
    // were produced inconsistently). We surface the mismatch but DO NOT override.
    var enriched = manifest.components.map(function (c, i) {
        var queue = hintQueueByComponent[c.component];
        var hint = queue && queue.length ? queue.shift() : undefined;
        if ((hint === null || hint === void 0 ? void 0 : hint.variant) && hint.variant !== c.variantPath) {
            warnings.push("Mismatch for ".concat(c.component, ": JSX data-ds-variant=\"").concat(hint.variant, "\" vs usage.json \"").concat(c.variantPath, "\". Using usage.json. Fix the upstream generator so both files agree."));
        }
        if ((hint === null || hint === void 0 ? void 0 : hint.nodeId) && c.figmaNodeId && hint.nodeId !== c.figmaNodeId) {
            warnings.push("Mismatch for ".concat(c.component, ": JSX data-ds-node-id=\"").concat(hint.nodeId, "\" vs usage.json \"").concat(c.figmaNodeId, "\". Using usage.json."));
        }
        return __assign(__assign({}, c), { 
            // Always trust usage.json; fall back to JSX hint only when usage.json is empty.
            variantPath: c.variantPath, figmaNodeId: c.figmaNodeId || (hint === null || hint === void 0 ? void 0 : hint.nodeId) || '', widthHint: hint === null || hint === void 0 ? void 0 : hint.widthHint, heightHint: hint === null || hint === void 0 ? void 0 : hint.heightHint, globalOrder: i });
    });
    // Stable sort: section-known-order, then orderInSection
    enriched.sort(function (a, b) {
        var sa = SECTION_ORDER.indexOf(a.placement.section);
        var sb = SECTION_ORDER.indexOf(b.placement.section);
        var ai = sa === -1 ? 999 + a.globalOrder : sa;
        var bi = sb === -1 ? 999 + b.globalOrder : sb;
        if (ai !== bi)
            return ai - bi;
        return a.placement.orderInSection - b.placement.orderInSection;
    });
    enriched.forEach(function (e, i) { return (e.globalOrder = i); });
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
    var _a;
    var cur = node;
    while (cur) {
        if (cur.type === 'COMPONENT' || cur.type === 'COMPONENT_SET') {
            return { type: cur.type, node: cur };
        }
        cur = (_a = cur.parent) !== null && _a !== void 0 ? _a : null;
    }
    return null;
}
function pickVariantFromSet(set, entry, mode) {
    var e_2, _a, e_3, _b;
    var _c, _d, _e;
    var variantProps = parseVariantPath(entry.variantPath);
    if (variantProps.Mode || ((_d = (_c = set.children[0]) === null || _c === void 0 ? void 0 : _c.variantProperties) === null || _d === void 0 ? void 0 : _d.Mode)) {
        variantProps.Mode = mode;
    }
    var exact = set.children.find(function (c) {
        return matchesVariantProps(c, variantProps);
    });
    if (exact)
        return exact;
    // Partial match: highest overlap of variant keys
    var best = null;
    try {
        for (var _f = __values(set.children), _g = _f.next(); !_g.done; _g = _f.next()) {
            var c = _g.value;
            var vp = c.variantProperties;
            if (!vp)
                continue;
            var score = 0;
            try {
                for (var _h = (e_3 = void 0, __values(Object.keys(variantProps))), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var k = _j.value;
                    if (vp[k] === variantProps[k])
                        score++;
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_b = _h.return)) _b.call(_h);
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
            if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return (_e = best === null || best === void 0 ? void 0 : best.node) !== null && _e !== void 0 ? _e : null;
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
                        if ((root === null || root === void 0 ? void 0 : root.type) === 'COMPONENT') {
                            if (node.id !== root.node.id) {
                                uiLog("    \u2191 node is inside component \"".concat(root.node.name, "\" \u2014 using parent"), '#93c5fd');
                            }
                            parent = root.node.parent;
                            if (parent && parent.type === 'COMPONENT_SET') {
                                match = pickVariantFromSet(parent, entry, mode);
                                if (match)
                                    return [2 /*return*/, { node: match, matchType: 'set-variant' }];
                            }
                            return [2 /*return*/, { node: root.node, matchType: 'exact-id' }];
                        }
                        if ((root === null || root === void 0 ? void 0 : root.type) === 'COMPONENT_SET') {
                            match = pickVariantFromSet(root.node, entry, mode);
                            if (match) {
                                uiLog("    \u2191 node is inside set \"".concat(root.node.name, "\" \u2014 picked variant \"").concat(match.name, "\""), '#93c5fd');
                                return [2 /*return*/, { node: match, matchType: 'set-variant' }];
                            }
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
                    if (!(tl === null || tl === void 0 ? void 0 : tl.getAvailableComponentsAsync)) return [3 /*break*/, 11];
                    return [4 /*yield*/, tl.getAvailableComponentsAsync()];
                case 9:
                    available = _d.sent();
                    want_1 = entry.component.toLowerCase();
                    remote = available.find(function (c) { return c.name.toLowerCase().includes(want_1); });
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
// ---------- Helpers: apply props + text ----------
var VARIANT_PROP_MAP = {
    style: 'Style',
    size: 'Size',
    mode: 'Mode',
    state: 'State',
    icon: 'Icon',
};
function applyProps(instance, props, mode) {
    var e_4, _a;
    var overrides = {};
    try {
        for (var _b = __values(Object.keys(props)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var k = _c.value;
            var figmaKey = VARIANT_PROP_MAP[k.toLowerCase()];
            if (figmaKey)
                overrides[figmaKey] = String(props[k]);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    overrides['Mode'] = mode;
    try {
        if (Object.keys(overrides).length > 0) {
            instance.setProperties(overrides);
        }
    }
    catch (e) {
        uiLog("  ! could not apply variant props: ".concat(e.message), '#fbbf24');
    }
}
function setTextContent(instance, label) {
    return __awaiter(this, void 0, void 0, function () {
        var textNodes, t, e_5;
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
                    e_5 = _a.sent();
                    uiLog("  ! font load failed: ".concat(e_5.message), '#fbbf24');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ---------- Placeholder ----------
function createMissingPlaceholder(instruction) {
    return __awaiter(this, void 0, void 0, function () {
        var f, label, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    f = figma.createFrame();
                    f.name = "[MISSING] ".concat(instruction.variantPath);
                    f.resize((_b = instruction.widthHint) !== null && _b !== void 0 ? _b : 320, (_c = instruction.heightHint) !== null && _c !== void 0 ? _c : 48);
                    f.fills = [{ type: 'SOLID', color: { r: 1, g: 0.95, b: 0.95 } }];
                    f.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.2, b: 0.2 } }];
                    f.strokeWeight = 1.5;
                    f.dashPattern = [4, 4];
                    f.setPluginData('ds-missing', instruction.component);
                    f.setPluginData('ds-missing-variant', instruction.variantPath);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, figma.loadFontAsync({ family: 'Inter', style: 'Regular' })];
                case 2:
                    _d.sent();
                    label = figma.createText();
                    label.fontName = { family: 'Inter', style: 'Regular' };
                    label.characters = "".concat(instruction.component, " \u00B7 ").concat(instruction.variantPath);
                    label.fontSize = 11;
                    label.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.1, b: 0.1 } }];
                    label.x = 8;
                    label.y = 8;
                    f.appendChild(label);
                    return [3 /*break*/, 4];
                case 3:
                    _a = _d.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, f];
            }
        });
    });
}
// ---------- Build ----------
function buildScreen(manifest, instructions, targetFrame, options) {
    return __awaiter(this, void 0, void 0, function () {
        var MAX_HEIGHT, frame, currentSection, sectionFrame, exactMatch, nameMatch, missing, approximate, instructions_1, instructions_1_1, instr, _a, node, matchType, instance, parentSet, set, seed, variantProps, sample, ph, e_6_1, customCount, e_7;
        var e_6, _b;
        var _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    MAX_HEIGHT = 10000;
                    frame = targetFrame !== null && targetFrame !== void 0 ? targetFrame : figma.createFrame();
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
                    currentSection = '';
                    sectionFrame = null;
                    exactMatch = 0;
                    nameMatch = 0;
                    missing = [];
                    approximate = [];
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 10, 11, 12]);
                    instructions_1 = __values(instructions), instructions_1_1 = instructions_1.next();
                    _f.label = 2;
                case 2:
                    if (!!instructions_1_1.done) return [3 /*break*/, 9];
                    instr = instructions_1_1.value;
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
                            uiLog("  ! section FILL failed: ".concat(e.message), '#fbbf24');
                        }
                        uiLog("\u25B8 section: ".concat(currentSection), '#93c5fd');
                    }
                    uiLog("  \u2022 ".concat(instr.component, " ").concat(instr.variantPath));
                    return [4 /*yield*/, resolveComponent(instr, options.mode)];
                case 3:
                    _a = _f.sent(), node = _a.node, matchType = _a.matchType;
                    if (!(node && sectionFrame)) return [3 /*break*/, 6];
                    instance = void 0;
                    parentSet = node.parent;
                    if (parentSet && parentSet.type === 'COMPONENT_SET') {
                        set = parentSet;
                        seed = (_c = set.defaultVariant) !== null && _c !== void 0 ? _c : node;
                        instance = seed.createInstance();
                        variantProps = parseVariantPath(instr.variantPath);
                        sample = (_d = set.children[0]) === null || _d === void 0 ? void 0 : _d.variantProperties;
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
                        instance = node.createInstance();
                    }
                    applyProps(instance, instr.props, options.mode);
                    if (!(instr.props && instr.props.label)) return [3 /*break*/, 5];
                    return [4 /*yield*/, setTextContent(instance, String(instr.props.label))];
                case 4:
                    _f.sent();
                    _f.label = 5;
                case 5:
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
                    catch (_g) { }
                    if (matchType === 'exact-id' || matchType === 'set-variant') {
                        exactMatch++;
                        uiLog("    \u2713 ".concat(matchType), '#86efac');
                    }
                    else if (matchType === 'name-match') {
                        nameMatch++;
                        approximate.push(instr.variantPath);
                        uiLog("    ~ name-match", '#fbbf24');
                    }
                    return [3 /*break*/, 8];
                case 6:
                    if (!sectionFrame) return [3 /*break*/, 8];
                    return [4 /*yield*/, createMissingPlaceholder(instr)];
                case 7:
                    ph = _f.sent();
                    sectionFrame.appendChild(ph);
                    try {
                        ph.layoutSizingHorizontal = 'FILL';
                    }
                    catch (_h) { }
                    missing.push(instr.variantPath);
                    uiLog("    \u2717 missing \u2192 placeholder", '#fca5a5');
                    _f.label = 8;
                case 8:
                    instructions_1_1 = instructions_1.next();
                    return [3 /*break*/, 2];
                case 9: return [3 /*break*/, 12];
                case 10:
                    e_6_1 = _f.sent();
                    e_6 = { error: e_6_1 };
                    return [3 /*break*/, 12];
                case 11:
                    try {
                        if (instructions_1_1 && !instructions_1_1.done && (_b = instructions_1.return)) _b.call(instructions_1);
                    }
                    finally { if (e_6) throw e_6.error; }
                    return [7 /*endfinally*/];
                case 12:
                    customCount = 0;
                    if (!(options.customInstructions && options.customInstructions.length > 0)) return [3 /*break*/, 16];
                    uiLog("\u25B8 rendering ".concat(options.customInstructions.length, " custom elements"), '#93c5fd');
                    _f.label = 13;
                case 13:
                    _f.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, buildCustomNodes(options.customInstructions, frame)];
                case 14:
                    customCount = _f.sent();
                    return [3 /*break*/, 16];
                case 15:
                    e_7 = _f.sent();
                    uiLog("! custom node pass failed: ".concat(e_7.message), '#fca5a5');
                    return [3 /*break*/, 16];
                case 16:
                    if (!targetFrame) {
                        frame.x = figma.viewport.center.x - options.width / 2;
                        frame.y = figma.viewport.center.y - options.height / 2;
                        figma.currentPage.appendChild(frame);
                    }
                    // Split if too tall
                    if (((_e = frame.height) !== null && _e !== void 0 ? _e : 0) > MAX_HEIGHT) {
                        uiLog("! frame height ".concat(Math.round(frame.height), " > ").concat(MAX_HEIGHT, ", splitting"), '#fbbf24');
                        splitFrame(frame, MAX_HEIGHT);
                    }
                    return [2 /*return*/, {
                            screen: manifest.screen,
                            frameNodeId: frame.id,
                            total: instructions.length,
                            exactMatch: exactMatch,
                            nameMatch: nameMatch,
                            missing: missing,
                            approximate: approximate,
                            mdVersion: manifest.designMdVersion || '',
                            customCount: customCount,
                        }];
            }
        });
    });
}
function splitFrame(frame, maxHeight) {
    var e_8, _a, e_9, _b;
    // Best-effort: clone overflowing children into _part2, _part3 frames
    var part = 2;
    var yAccum = 0;
    var overflowChildren = [];
    try {
        for (var _c = __values(__spreadArray([], __read(frame.children), false)), _d = _c.next(); !_d.done; _d = _c.next()) {
            var child = _d.value;
            yAccum += child.height || 0;
            if (yAccum > maxHeight)
                overflowChildren.push(child);
        }
    }
    catch (e_8_1) { e_8 = { error: e_8_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_8) throw e_8.error; }
    }
    while (overflowChildren.length) {
        var next = frame.clone();
        next.name = frame.name + "_part".concat(part++);
        try {
            // Remove all children, then re-append overflow batch
            for (var _e = (e_9 = void 0, __values(__spreadArray([], __read(next.children), false))), _f = _e.next(); !_f.done; _f = _e.next()) {
                var c = _f.value;
                c.remove();
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
            }
            finally { if (e_9) throw e_9.error; }
        }
        var h = 0;
        var taken = [];
        while (overflowChildren.length && h < maxHeight) {
            var c = overflowChildren.shift();
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
    var hints = [];
    var customInstructions = [];
    var sectionMap = {};
    var TOKEN_HEX = {
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
        var tokenMatch = raw.match(/tokens\[['"]([^'"]+)['"]\]/);
        if (tokenMatch)
            return (_a = TOKEN_HEX[tokenMatch[1]]) !== null && _a !== void 0 ? _a : raw;
        if (raw.startsWith('#'))
            return raw;
        if (raw.startsWith('rgb'))
            return raw;
        return raw;
    }
    function parseInlineStyles(styleStr) {
        var e_10, _a;
        var styles = {};
        var pairs = styleStr.matchAll(/(\w+):\s*([^,}]+)/g);
        try {
            for (var _b = __values(pairs), _c = _b.next(); !_c.done; _c = _b.next()) {
                var match = _c.value;
                var key = match[1];
                var rawVal = match[2];
                var val = String(rawVal).trim().replace(/['"]/g, '');
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
                        var p = parseFloat(val);
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
        }
        catch (e_10_1) { e_10 = { error: e_10_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_10) throw e_10.error; }
        }
        return styles;
    }
    var lines = tsxText.split('\n');
    var currentSection = 'Body';
    var orderIndex = 0;
    var depth = 0;
    var depthStack = ['root'];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var sectionMatch = line.match(/\{\/\*\s*Section:\s*([A-Za-z0-9_-]+)\s*\*\/\}/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            continue;
        }
        if (line.includes('data-ds-component=')) {
            var compM = line.match(/data-ds-component=["']([^"']+)["']/);
            var variantM = line.match(/data-ds-variant=["']([^"']+)["']/);
            var nodeIdM = line.match(/data-ds-node-id=["']([^"']+)["']/);
            if (compM) {
                var hint = { component: compM[1] };
                if (variantM)
                    hint.variant = variantM[1];
                if (nodeIdM)
                    hint.nodeId = nodeIdM[1];
                hints.push(hint);
            }
            continue;
        }
        var openTagMatch = line.match(/^\s*<(div|section|main|header|footer|p|h[1-6]|span)\s/);
        if (openTagMatch) {
            var tag = openTagMatch[1];
            var id = "node-".concat(orderIndex.toString().padStart(3, '0'));
            var parentId = (_a = depthStack[depthStack.length - 1]) !== null && _a !== void 0 ? _a : 'root';
            var styleMatch = line.match(/style=\{\{(.+?)(?:\}\}|$)/s);
            var styleStr = styleMatch ? styleMatch[1] : '';
            if (styleMatch && !line.includes('}}')) {
                for (var j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    styleStr += ' ' + lines[j];
                    if (lines[j].includes('}}')) {
                        i = j;
                        break;
                    }
                }
            }
            var styles = parseInlineStyles(styleStr);
            var category = 'custom-frame';
            var inferredType = 'frame';
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span'].includes(tag)) {
                var textMatch = ((_b = lines[i + 1]) !== null && _b !== void 0 ? _b : '').match(/^\s*([^<{]+?)\s*$/);
                if (textMatch) {
                    category = 'custom-text';
                    inferredType = 'text';
                }
            }
            var prevLine = (_c = lines[i - 1]) !== null && _c !== void 0 ? _c : '';
            if (prevLine.includes('image:'))
                inferredType = 'image-placeholder';
            if (prevLine.includes('icon:'))
                inferredType = 'icon-placeholder';
            if (styles.height === 1 || (typeof styles.height === 'number' && styles.height <= 2)) {
                inferredType = 'divider';
            }
            var instr = {
                id: id,
                category: category,
                depth: depth,
                parentId: parentId,
                tag: tag,
                inferredType: inferredType,
                sectionName: currentSection,
                styles: styles,
                orderIndex: orderIndex++,
            };
            if (category === 'custom-text') {
                var textLine = (_d = lines[i + 1]) === null || _d === void 0 ? void 0 : _d.trim();
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
    return { hints: hints, customInstructions: customInstructions, sectionMap: sectionMap };
}
function hexToRgb(hex) {
    var clean = hex.replace('#', '').replace(/ff$/i, '');
    if (clean.length === 6) {
        return {
            r: parseInt(clean.slice(0, 2), 16) / 255,
            g: parseInt(clean.slice(2, 4), 16) / 255,
            b: parseInt(clean.slice(4, 6), 16) / 255,
        };
    }
    var rgbMatch = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
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
    var m = shadow.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s*(\d+)?px?\s*rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
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
    var map = {
        'flex-start': 'MIN', 'start': 'MIN',
        'center': 'CENTER',
        'flex-end': 'MAX', 'end': 'MAX',
        'space-between': 'SPACE_BETWEEN',
    };
    return (_a = map[val !== null && val !== void 0 ? val : 'flex-start']) !== null && _a !== void 0 ? _a : 'MIN';
}
function mapAlign(val) {
    var _a;
    var map = {
        'flex-start': 'MIN', 'start': 'MIN',
        'center': 'CENTER',
        'flex-end': 'MAX', 'end': 'MAX',
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
function buildCustomNodes(instructions, rootFrame) {
    return __awaiter(this, void 0, void 0, function () {
        function getSectionFrame(sectionName) {
            var e_13, _a;
            try {
                for (var _b = __values(rootFrame.children), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var child = _c.value;
                    if (child.name === sectionName && child.type === 'FRAME')
                        return child;
                }
            }
            catch (e_13_1) { e_13 = { error: e_13_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_13) throw e_13.error; }
            }
            var sf = figma.createFrame();
            sf.name = sectionName;
            sf.layoutMode = 'VERTICAL';
            sf.counterAxisSizingMode = 'FIXED';
            sf.primaryAxisSizingMode = 'AUTO';
            sf.fills = [];
            rootFrame.appendChild(sf);
            try {
                sf.layoutSizingHorizontal = 'FILL';
            }
            catch (_d) { }
            return sf;
        }
        var nodeMap, count, instructions_2, instructions_2_1, instr, parentNode, created, t, weight, style, _a, col, r, w, h, col, f, col, shadow, e_11, e_12_1;
        var e_12, _b;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    nodeMap = new Map();
                    nodeMap.set('root', rootFrame);
                    count = 0;
                    _m.label = 1;
                case 1:
                    _m.trys.push([1, 14, 15, 16]);
                    instructions_2 = __values(instructions), instructions_2_1 = instructions_2.next();
                    _m.label = 2;
                case 2:
                    if (!!instructions_2_1.done) return [3 /*break*/, 13];
                    instr = instructions_2_1.value;
                    parentNode = (_d = nodeMap.get((_c = instr.parentId) !== null && _c !== void 0 ? _c : 'root')) !== null && _d !== void 0 ? _d : getSectionFrame((_e = instr.sectionName) !== null && _e !== void 0 ? _e : 'Body');
                    created = null;
                    _m.label = 3;
                case 3:
                    _m.trys.push([3, 11, , 12]);
                    if (!(instr.category === 'custom-text')) return [3 /*break*/, 9];
                    t = figma.createText();
                    weight = (_f = instr.styles.fontWeight) !== null && _f !== void 0 ? _f : 400;
                    style = weight >= 700 ? 'Bold' : weight >= 600 ? 'SemiBold' : weight >= 500 ? 'Medium' : 'Regular';
                    _m.label = 4;
                case 4:
                    _m.trys.push([4, 6, , 8]);
                    return [4 /*yield*/, figma.loadFontAsync({ family: 'Inter', style: style })];
                case 5:
                    _m.sent();
                    return [3 /*break*/, 8];
                case 6:
                    _a = _m.sent();
                    return [4 /*yield*/, figma.loadFontAsync({ family: 'Inter', style: 'Regular' })];
                case 7:
                    _m.sent();
                    return [3 /*break*/, 8];
                case 8:
                    t.fontName = { family: 'Inter', style: style };
                    t.characters = (_g = instr.textContent) !== null && _g !== void 0 ? _g : '';
                    if (instr.styles.fontSize)
                        t.fontSize = instr.styles.fontSize;
                    if (instr.styles.lineHeight)
                        t.lineHeight = { value: instr.styles.lineHeight, unit: 'PIXELS' };
                    if (instr.styles.color) {
                        col = hexToRgb(instr.styles.color);
                        if (col)
                            t.fills = [{ type: 'SOLID', color: col }];
                    }
                    t.setPluginData('ds-linked', 'false');
                    t.setPluginData('ds-custom-type', 'text');
                    parentNode.appendChild(t);
                    created = t;
                    return [3 /*break*/, 10];
                case 9:
                    if (instr.inferredType === 'image-placeholder' ||
                        instr.inferredType === 'icon-placeholder' ||
                        instr.inferredType === 'divider') {
                        r = figma.createRectangle();
                        r.name = instr.inferredType === 'divider'
                            ? '[divider]'
                            : "[".concat(instr.inferredType, "] ").concat((_h = instr.className) !== null && _h !== void 0 ? _h : '');
                        w = typeof instr.styles.width === 'number' ? instr.styles.width : 40;
                        h = typeof instr.styles.height === 'number' ? instr.styles.height : 40;
                        r.resize(Math.max(1, w), Math.max(1, h));
                        if (instr.styles.backgroundColor) {
                            col = hexToRgb(instr.styles.backgroundColor);
                            if (col)
                                r.fills = [{ type: 'SOLID', color: col }];
                        }
                        if (instr.styles.borderRadius)
                            r.cornerRadius = instr.styles.borderRadius;
                        r.setPluginData('ds-linked', 'false');
                        r.setPluginData('ds-custom-type', (_j = instr.inferredType) !== null && _j !== void 0 ? _j : 'rect');
                        parentNode.appendChild(r);
                        applyRectSizing(r, instr, parentNode);
                        created = r;
                    }
                    else {
                        f = figma.createFrame();
                        f.name = (_l = (_k = instr.className) !== null && _k !== void 0 ? _k : instr.tag) !== null && _l !== void 0 ? _l : 'frame';
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
                            col = hexToRgb(instr.styles.backgroundColor);
                            if (col)
                                f.fills = [{ type: 'SOLID', color: col }];
                        }
                        if (instr.styles.borderRadius)
                            f.cornerRadius = instr.styles.borderRadius;
                        if (instr.styles.opacity !== undefined)
                            f.opacity = instr.styles.opacity;
                        if (instr.styles.boxShadow) {
                            shadow = parseBoxShadow(instr.styles.boxShadow);
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
                    _m.label = 10;
                case 10:
                    if (created) {
                        nodeMap.set(instr.id, created);
                        count++;
                    }
                    return [3 /*break*/, 12];
                case 11:
                    e_11 = _m.sent();
                    uiLog("  ! custom node ".concat(instr.tag, " failed: ").concat(e_11.message), '#fbbf24');
                    return [3 /*break*/, 12];
                case 12:
                    instructions_2_1 = instructions_2.next();
                    return [3 /*break*/, 2];
                case 13: return [3 /*break*/, 16];
                case 14:
                    e_12_1 = _m.sent();
                    e_12 = { error: e_12_1 };
                    return [3 /*break*/, 16];
                case 15:
                    try {
                        if (instructions_2_1 && !instructions_2_1.done && (_b = instructions_2.return)) _b.call(instructions_2);
                    }
                    finally { if (e_12) throw e_12.error; }
                    return [7 /*endfinally*/];
                case 16: return [2 /*return*/, count];
            }
        });
    });
}
function resyncSelection() {
    return __awaiter(this, void 0, void 0, function () {
        var sel, updated, _a, _b, child, variantPath, component, nodeId, fakeInstr, node, e_14_1;
        var e_14, _c;
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
                        placement: { section: child.getPluginData('ds-section'), semanticRole: '', orderInSection: 0 },
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
                    e_14_1 = _d.sent();
                    e_14 = { error: e_14_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_14) throw e_14.error; }
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
        mdVersion: n.getPluginData('ds-md-version'),
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
            section: n.getPluginData('ds-section') || 'Body',
            semanticRole: '',
            orderInSection: Number(n.getPluginData('ds-order')) || i,
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
    var _a, type, payload, manifest, warnings, parsedTsx, hints, customInstructions, _b, instructions, w2, customCounts_1, customInstructions_1, customInstructions_1_1, ci, k, customGroups, preview, counts, instructions_3, instructions_3_1, inst, seen, _loop_2, instructions_4, instructions_4_1, inst, e_15_1, target, n, report, n, e_16;
    var e_17, _c, e_18, _d, e_15, _e;
    var _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                _a = msg, type = _a.type, payload = _a.payload;
                _g.label = 1;
            case 1:
                _g.trys.push([1, 21, , 22]);
                if (!(type === 'init')) return [3 /*break*/, 3];
                return [4 /*yield*/, sendInit()];
            case 2:
                _g.sent();
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
                if (manifest.designMdVersion && !KNOWN_MD_VERSIONS.includes(manifest.designMdVersion)) {
                    warnings.push("This usage.json was generated from Design MD v".concat(manifest.designMdVersion, ". Current spec may differ \u2014 verify missing/approximate components."));
                }
                parsedTsx = payload.jsxText
                    ? parseFullTsx(payload.jsxText)
                    : { hints: [], customInstructions: [] };
                hints = parsedTsx.hints, customInstructions = parsedTsx.customInstructions;
                _b = buildInstructions(manifest, hints), instructions = _b.instructions, w2 = _b.warnings;
                warnings.push.apply(warnings, __spreadArray([], __read(w2), false));
                parsedManifest = manifest;
                parsedInstructions = instructions;
                parsedCustomInstructions = customInstructions;
                customCounts_1 = {};
                try {
                    for (customInstructions_1 = __values(customInstructions), customInstructions_1_1 = customInstructions_1.next(); !customInstructions_1_1.done; customInstructions_1_1 = customInstructions_1.next()) {
                        ci = customInstructions_1_1.value;
                        k = (_f = ci.inferredType) !== null && _f !== void 0 ? _f : ci.category;
                        customCounts_1[k] = (customCounts_1[k] || 0) + 1;
                    }
                }
                catch (e_17_1) { e_17 = { error: e_17_1 }; }
                finally {
                    try {
                        if (customInstructions_1_1 && !customInstructions_1_1.done && (_c = customInstructions_1.return)) _c.call(customInstructions_1);
                    }
                    finally { if (e_17) throw e_17.error; }
                }
                customGroups = Object.keys(customCounts_1).map(function (k) { return ({
                    type: k,
                    count: customCounts_1[k],
                }); });
                preview = [];
                counts = {};
                try {
                    for (instructions_3 = __values(instructions), instructions_3_1 = instructions_3.next(); !instructions_3_1.done; instructions_3_1 = instructions_3.next()) {
                        inst = instructions_3_1.value;
                        counts[inst.variantPath] = (counts[inst.variantPath] || 0) + 1;
                    }
                }
                catch (e_18_1) { e_18 = { error: e_18_1 }; }
                finally {
                    try {
                        if (instructions_3_1 && !instructions_3_1.done && (_d = instructions_3.return)) _d.call(instructions_3);
                    }
                    finally { if (e_18) throw e_18.error; }
                }
                seen = new Set();
                _loop_2 = function (inst) {
                    var status, n, _h, tl, available, _j;
                    return __generator(this, function (_k) {
                        switch (_k.label) {
                            case 0:
                                if (seen.has(inst.variantPath))
                                    return [2 /*return*/, "continue"];
                                seen.add(inst.variantPath);
                                status = 'missing';
                                if (!inst.figmaNodeId) return [3 /*break*/, 4];
                                _k.label = 1;
                            case 1:
                                _k.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, figma.getNodeByIdAsync(inst.figmaNodeId)];
                            case 2:
                                n = _k.sent();
                                if (n && n.type === 'COMPONENT')
                                    status = 'exact';
                                return [3 /*break*/, 4];
                            case 3:
                                _h = _k.sent();
                                return [3 /*break*/, 4];
                            case 4:
                                if (!(status === 'missing')) return [3 /*break*/, 9];
                                _k.label = 5;
                            case 5:
                                _k.trys.push([5, 8, , 9]);
                                tl = figma.teamLibrary;
                                if (!(tl === null || tl === void 0 ? void 0 : tl.getAvailableComponentsAsync)) return [3 /*break*/, 7];
                                return [4 /*yield*/, tl.getAvailableComponentsAsync()];
                            case 6:
                                available = _k.sent();
                                if (available.find(function (c) {
                                    return c.name.toLowerCase().includes(inst.component.toLowerCase());
                                })) {
                                    status = 'name';
                                }
                                _k.label = 7;
                            case 7: return [3 /*break*/, 9];
                            case 8:
                                _j = _k.sent();
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
                _g.label = 4;
            case 4:
                _g.trys.push([4, 9, 10, 11]);
                instructions_4 = __values(instructions), instructions_4_1 = instructions_4.next();
                _g.label = 5;
            case 5:
                if (!!instructions_4_1.done) return [3 /*break*/, 8];
                inst = instructions_4_1.value;
                return [5 /*yield**/, _loop_2(inst)];
            case 6:
                _g.sent();
                _g.label = 7;
            case 7:
                instructions_4_1 = instructions_4.next();
                return [3 /*break*/, 5];
            case 8: return [3 /*break*/, 11];
            case 9:
                e_15_1 = _g.sent();
                e_15 = { error: e_15_1 };
                return [3 /*break*/, 11];
            case 10:
                try {
                    if (instructions_4_1 && !instructions_4_1.done && (_e = instructions_4.return)) _e.call(instructions_4);
                }
                finally { if (e_15) throw e_15.error; }
                return [7 /*endfinally*/];
            case 11:
                figma.ui.postMessage({
                    type: 'parsed',
                    payload: {
                        preview: preview,
                        warnings: warnings,
                        customGroups: customGroups,
                        customCount: parsedCustomInstructions.length,
                    },
                });
                return [2 /*return*/];
            case 12:
                if (!(type === 'build')) return [3 /*break*/, 16];
                if (!parsedManifest || !parsedInstructions.length) {
                    uiError('Parse a usage.json first.');
                    return [2 /*return*/];
                }
                target = null;
                if (!(payload.targetFrameId && payload.targetFrameId !== '__new__')) return [3 /*break*/, 14];
                return [4 /*yield*/, figma.getNodeByIdAsync(payload.targetFrameId)];
            case 13:
                n = _g.sent();
                if (n && n.type === 'FRAME')
                    target = n;
                _g.label = 14;
            case 14: return [4 /*yield*/, buildScreen(parsedManifest, parsedInstructions, target, {
                    width: payload.width,
                    height: payload.height,
                    mode: payload.mode,
                    customInstructions: parsedCustomInstructions,
                })];
            case 15:
                report = _g.sent();
                figma.ui.postMessage({ type: 'built', payload: report });
                uiLog("done \u00B7 ".concat(report.exactMatch + report.nameMatch, "/").concat(report.total, " placed"), '#86efac');
                return [2 /*return*/];
            case 16:
                if (!(type === 'zoom')) return [3 /*break*/, 18];
                return [4 /*yield*/, figma.getNodeByIdAsync(payload.frameId)];
            case 17:
                n = _g.sent();
                if (n && 'visible' in n) {
                    figma.currentPage.selection = [n];
                    figma.viewport.scrollAndZoomIntoView([n]);
                }
                return [2 /*return*/];
            case 18:
                if (!(type === 'resync')) return [3 /*break*/, 20];
                return [4 /*yield*/, resyncSelection()];
            case 19:
                _g.sent();
                return [2 /*return*/];
            case 20:
                if (type === 'audit') {
                    auditSelection();
                    return [2 /*return*/];
                }
                if (type === 'reverse') {
                    reverseExport();
                    return [2 /*return*/];
                }
                return [3 /*break*/, 22];
            case 21:
                e_16 = _g.sent();
                uiError(e_16.message);
                return [3 /*break*/, 22];
            case 22: return [2 /*return*/];
        }
    });
}); };
