// Sen Money DS Mapper
// - Enumerates attached libraries + component usage (Plugin API)
// - Fetches FULL design system catalog from a Figma library file via REST API
//   using a personal access token stored in figma.clientStorage.

figma.showUI(__html__, { width: 560, height: 760 });

var STORAGE_TOKEN = 'figma_pat';
var STORAGE_LIBRARY_URL = 'library_file_url';
var STORAGE_CATALOG = 'library_catalog';
var STORAGE_CATALOG_SUMMARY = 'library_catalog_summary';

function post(type, payload) {
  figma.ui.postMessage(Object.assign({ type: type }, payload || {}));
}

// ---------- helpers ----------
function ensureLibrary(result, name) {
  if (!result.librariesByName[name]) {
    result.librariesByName[name] = { variableCollections: 0, components: 0 };
  }
}

function getPageName(node) {
  var current = node;
  while (current && current.type !== 'PAGE') current = current.parent;
  return current ? current.name : 'Unknown page';
}

function extractFileKey(url) {
  if (!url) return null;
  var m = String(url).match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

// ---------- in-file usage scan ----------
async function scanUsedComponents(scope) {
  var root = scope === 'file' ? figma.root : figma.currentPage;
  if (scope === 'file' && typeof figma.loadAllPagesAsync === 'function') {
    await figma.loadAllPagesAsync();
  }
  var instances = root.findAll(function (node) { return node.type === 'INSTANCE'; });
  var byKey = {};
  for (var i = 0; i < instances.length; i++) {
    var instance = instances[i];
    var main = null;
    try {
      main = instance.getMainComponentAsync ? await instance.getMainComponentAsync() : instance.mainComponent;
    } catch (e) {}
    if (!main) continue;
    var parentSet = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : null;
    var key = (parentSet && parentSet.key) || main.key || main.id;
    var name = parentSet ? parentSet.name : main.name;
    var variant = parentSet ? main.name : '';
    var page = getPageName(instance);
    if (!byKey[key]) {
      byKey[key] = { key: key, name: name, remote: !!main.remote, instanceCount: 0, variantsByName: {}, pagesByName: {} };
    }
    byKey[key].instanceCount += 1;
    byKey[key].pagesByName[page] = true;
    if (variant) byKey[key].variantsByName[variant] = true;
  }
  return Object.keys(byKey).map(function (key) {
    var item = byKey[key];
    return {
      key: item.key, name: item.name, remote: item.remote,
      instanceCount: item.instanceCount,
      variants: Object.keys(item.variantsByName).sort(),
      pages: Object.keys(item.pagesByName).sort()
    };
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });
}

async function listAttached(scope) {
  var result = { variableCollections: [], usedComponents: [], librariesByName: {}, errors: [], scope: scope || 'page' };
  try {
    var collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    result.variableCollections = collections.map(function (c) {
      return { key: c.key, name: c.name, libraryName: c.libraryName };
    });
    collections.forEach(function (c) {
      ensureLibrary(result, c.libraryName);
      result.librariesByName[c.libraryName].variableCollections += 1;
    });
  } catch (e) {
    result.errors.push('Variable collections: ' + (e && e.message ? e.message : String(e)));
  }
  try {
    result.usedComponents = await scanUsedComponents(result.scope);
  } catch (e) {
    result.errors.push('Used component scan: ' + (e && e.message ? e.message : String(e)));
  }
  return result;
}

// ---------- REST API: full catalog ----------
async function figmaApi(path, token) {
  var res = await fetch('https://api.figma.com' + path, {
    headers: { 'X-Figma-Token': token }
  });
  if (!res.ok) {
    var text = '';
    try { text = await res.text(); } catch (e) {}
    throw new Error('Figma API ' + res.status + ': ' + (text || res.statusText));
  }
  return res.json();
}

async function fetchLibraryCatalog(fileKey, token) {
  post('status', { message: 'Fetching components...' });
  var componentsResp = await figmaApi('/v1/files/' + fileKey + '/components', token);
  var components = (componentsResp.meta && componentsResp.meta.components) || [];
  post('status', { message: 'Fetched ' + components.length + ' components. Fetching component sets...' });

  var setsResp = await figmaApi('/v1/files/' + fileKey + '/component_sets', token);
  var componentSets = (setsResp.meta && setsResp.meta.component_sets) || [];
  post('status', { message: 'Fetched ' + componentSets.length + ' sets. Fetching styles...' });

  var stylesResp = await figmaApi('/v1/files/' + fileKey + '/styles', token);
  var styles = (stylesResp.meta && stylesResp.meta.styles) || [];
  post('status', { message: 'Fetched ' + styles.length + ' styles. Preparing catalog...' });

  return {
    fileKey: fileKey,
    fileName: 'Library ' + fileKey,
    lastModified: null,
    fetchedAt: new Date().toISOString(),
    components: components.map(function (c) {
      return {
        key: c.key, name: c.name, description: c.description || '',
        nodeId: c.node_id || null,
        componentSetId: c.component_set_id || null
      };
    }),
    componentSets: componentSets.map(function (s) {
      return { key: s.key, name: s.name, description: s.description || '', nodeId: s.node_id || null };
    }),
    styles: styles.map(function (s) {
      return { key: s.key, name: s.name, styleType: s.style_type, description: s.description || '' };
    })
  };
}

// ---------- catalog-based component resolution ----------
function normalizeName(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseVariantPath(variantPath) {
  var out = {};
  if (!variantPath) return out;
  String(variantPath).split(',').forEach(function (pair) {
    var idx = pair.indexOf('=');
    if (idx === -1) return;
    var k = pair.slice(0, idx).trim();
    var v = pair.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function findInCatalog(catalog, instr) {
  if (!catalog) return { matchType: 'no-catalog' };
  var wantedName = normalizeName(instr.component);

  if (instr.libraryComponentKey) {
    return { matchType: 'instr-key', key: instr.libraryComponentKey, kind: 'component' };
  }
  // Match component set by node id
  if (instr.figmaComponentSetId) {
    for (var a = 0; a < catalog.componentSets.length; a++) {
      if (catalog.componentSets[a].nodeId === instr.figmaComponentSetId) {
        return { matchType: 'set-nodeId', key: catalog.componentSets[a].key, kind: 'set' };
      }
    }
  }
  // Match exact variant by node id
  if (instr.figmaNodeId) {
    for (var b = 0; b < catalog.components.length; b++) {
      if (catalog.components[b].nodeId === instr.figmaNodeId) {
        return { matchType: 'component-nodeId', key: catalog.components[b].key, kind: 'component' };
      }
    }
  }
  // Fallback: name match
  for (var i = 0; i < catalog.componentSets.length; i++) {
    if (normalizeName(catalog.componentSets[i].name) === wantedName) {
      return { matchType: 'set-name', key: catalog.componentSets[i].key, kind: 'set' };
    }
  }
  for (var j = 0; j < catalog.components.length; j++) {
    var c = catalog.components[j];
    if (c.componentSetId) continue;
    if (normalizeName(c.name) === wantedName) {
      return { matchType: 'component-name', key: c.key, kind: 'component' };
    }
  }
  for (var k = 0; k < catalog.components.length; k++) {
    if (normalizeName(catalog.components[k].name) === wantedName) {
      return { matchType: 'component-variant-name', key: catalog.components[k].key, kind: 'component' };
    }
  }
  return { matchType: 'missing' };
}

async function importFromCatalog(match) {
  if (!match || !match.key) return null;
  try {
    if (match.kind === 'set') {
      var set = await figma.importComponentSetByKeyAsync(match.key);
      return { node: set.defaultVariant || set, isSet: true, set: set, exactVariant: false };
    }
    var comp = await figma.importComponentByKeyAsync(match.key);
    // When matched via figmaNodeId the key is the EXACT variant — skip setProperties guessing.
    var exact = match.matchType === 'component-nodeId' || match.matchType === 'instr-key';
    return { node: comp, isSet: false, exactVariant: exact };
  } catch (e) {
    return null;
  }
}

function extractCoordinatesFromTsx(tsxText, componentName, occurrence) {
  var coords = { x: 0, y: 0, width: 0, height: 0, found: false };
  if (!tsxText) return coords;
  var lines = tsxText.split('\n');
  var seen = 0;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('data-ds-component="' + componentName + '"') === -1) continue;
    if (seen < (occurrence || 0)) { seen++; continue; }
    var block = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 10)).join(' ');
    var left = block.match(/left[:\s]+(\d+)/);
    var top = block.match(/top[:\s]+(\d+)/);
    var w = block.match(/width[:\s]+(\d+)/);
    var h = block.match(/height[:\s]+(\d+)/);
    if (left) { coords.x = parseInt(left[1], 10); coords.found = true; }
    if (top) { coords.y = parseInt(top[1], 10); coords.found = true; }
    if (w) coords.width = parseInt(w[1], 10);
    if (h) coords.height = parseInt(h[1], 10);
    break;
  }
  return coords;
}

function getPlacementCoords(placement) {
  if (!placement) return null;
  if (typeof placement.x === 'number' || typeof placement.width === 'number') {
    return {
      x: placement.x || 0, y: placement.y || 0,
      width: placement.width || 0, height: placement.height || 0
    };
  }
  return null;
}

async function parseInstructions(usageJson, tsxText) {
  var catalog = await figma.clientStorage.getAsync(STORAGE_CATALOG);
  var instructions = (usageJson && (usageJson.components || usageJson.instructions)) || [];
  var occurrenceByName = {};
  var preview = instructions.map(function (instr) {
    var name = instr.component;
    var occ = occurrenceByName[name] || 0;
    occurrenceByName[name] = occ + 1;

    var coords = getPlacementCoords(instr.placement)
      || extractCoordinatesFromTsx(tsxText, name, occ);
    var match = findInCatalog(catalog, instr);

    // Derive a reasonable label from props if not provided
    var props = instr.props || {};
    var label = props.label || props.title || props.text || '';

    return {
      component: name,
      variantPath: instr.variantPath || '',
      figmaNodeId: instr.figmaNodeId || null,
      figmaComponentSetId: instr.figmaComponentSetId || null,
      placement: {
        x: (coords && coords.x) || 0,
        y: (coords && coords.y) || 0,
        width: (coords && coords.width) || 320,
        height: (coords && coords.height) || 48
      },
      placementMeta: (instr.placement && !getPlacementCoords(instr.placement)) ? instr.placement : null,
      props: Object.assign({}, props, label ? { label: label } : {}),
      libraryComponentKey: instr.libraryComponentKey || null,
      matchType: match.matchType,
      matchKey: match.key || null,
      matchKind: match.kind || null
    };
  });
  var vp = (usageJson && usageJson.viewport) || {};
  return {
    hasCatalog: !!catalog,
    screen: (usageJson && usageJson.screen) || 'DS Mapped Screen',
    width: vp.width || (usageJson && usageJson.width) || 0,
    height: vp.height || (usageJson && usageJson.height) || 0,
    mode: (usageJson && usageJson.mode) || '',
    instructions: preview
  };
}

async function setTextContent(node, text) {
  if (!node.findAll) return;
  var textNodes = node.findAll(function (n) { return n.type === 'TEXT'; });
  if (!textNodes.length) return;
  var t = textNodes[0];
  try {
    await figma.loadFontAsync(t.fontName);
    t.characters = String(text);
  } catch (e) {}
}

async function buildScreen(payload) {
  var instructions = payload.instructions || [];
  var screenshotBytes = payload.screenshotBytes;
  var width = payload.width || 375;
  var height = payload.height || 812;
  var mode = payload.mode || '';
  var screenName = payload.screenName || 'DS Mapped Screen';

  var frame = figma.createFrame();
  frame.name = screenName;
  frame.resize(width, height);
  frame.layoutMode = 'NONE';
  frame.clipsContent = true;

  if (screenshotBytes && screenshotBytes.length) {
    var imageHash = figma.createImage(screenshotBytes).hash;
    frame.fills = [{ type: 'IMAGE', imageHash: imageHash, scaleMode: 'FILL' }];
  }
  frame.x = figma.viewport.center.x - width / 2;
  frame.y = figma.viewport.center.y - height / 2;
  figma.currentPage.appendChild(frame);

  var placed = 0, missing = 0, errors = [];

  for (var i = 0; i < instructions.length; i++) {
    var instr = instructions[i];
    var coords = instr.placement || { x: 0, y: 0, width: 320, height: 48 };
    var match = { matchType: instr.matchType, key: instr.matchKey, kind: instr.matchKind };
    var imported = match.key ? await importFromCatalog(match) : null;

    if (imported && imported.node) {
      var instance = imported.node.createInstance();
      var variantProps = parseVariantPath(instr.variantPath);
      if (mode) variantProps.Mode = mode;
      try { instance.setProperties(variantProps); } catch (e) {}
      if (instr.props && instr.props.label) {
        await setTextContent(instance, instr.props.label);
      }
      instance.x = coords.x;
      instance.y = coords.y;
      try { instance.resize(coords.width, coords.height); } catch (e) {}
      instance.setPluginData('ds-component', instr.component);
      instance.setPluginData('ds-variant', instr.variantPath || '');
      instance.setPluginData('ds-match-type', instr.matchType || '');
      frame.appendChild(instance);
      placed += 1;
    } else {
      var ph = figma.createFrame();
      ph.name = '[MISSING] ' + instr.component;
      ph.resize(Math.max(1, coords.width), Math.max(1, coords.height));
      ph.x = coords.x;
      ph.y = coords.y;
      ph.fills = [{ type: 'SOLID', color: { r: 1, g: 0.85, b: 0.85 }, opacity: 0.6 }];
      ph.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.1, b: 0.1 } }];
      ph.strokeWeight = 1;
      frame.appendChild(ph);
      missing += 1;
      errors.push(instr.component + ' (' + (instr.matchType || 'unresolved') + ')');
    }
  }

  figma.viewport.scrollAndZoomIntoView([frame]);
  return { placed: placed, missing: missing, errors: errors };
}

// ---------- bootstrap ----------
async function bootstrap() {
  var token = await figma.clientStorage.getAsync(STORAGE_TOKEN);
  var libraryUrl = await figma.clientStorage.getAsync(STORAGE_LIBRARY_URL);
  var catalogSummary = await figma.clientStorage.getAsync(STORAGE_CATALOG_SUMMARY);
  post('init', {
    hasToken: !!token,
    libraryUrl: libraryUrl || '',
    catalogSummary: catalogSummary || null,
    catalog: null,
    attached: null
  });
}

figma.ui.onmessage = async function (msg) {
  try {
    if (msg.type === 'save-config') {
      if (msg.token) await figma.clientStorage.setAsync(STORAGE_TOKEN, msg.token);
      if (msg.libraryUrl) await figma.clientStorage.setAsync(STORAGE_LIBRARY_URL, msg.libraryUrl);
      post('status', { message: 'Saved.' });
      post('config-saved', { hasToken: true, libraryUrl: msg.libraryUrl || '' });
    } else if (msg.type === 'clear-config') {
      await figma.clientStorage.deleteAsync(STORAGE_TOKEN);
      await figma.clientStorage.deleteAsync(STORAGE_LIBRARY_URL);
      await figma.clientStorage.deleteAsync(STORAGE_CATALOG);
      await figma.clientStorage.deleteAsync(STORAGE_CATALOG_SUMMARY);
      post('status', { message: 'Cleared.' });
      post('config-saved', { hasToken: false, libraryUrl: '' });
      post('catalog', { catalog: null });
      post('catalog-summary', { catalogSummary: null });
    } else if (msg.type === 'fetch-catalog') {
      var token = await figma.clientStorage.getAsync(STORAGE_TOKEN);
      var libraryUrl = msg.libraryUrl || await figma.clientStorage.getAsync(STORAGE_LIBRARY_URL);
      if (!token) { post('status', { message: 'Missing personal access token.' }); return; }
      var fileKey = extractFileKey(libraryUrl);
      if (!fileKey) { post('status', { message: 'Invalid Figma file URL.' }); return; }
      if (libraryUrl) await figma.clientStorage.setAsync(STORAGE_LIBRARY_URL, libraryUrl);
      var catalog = await fetchLibraryCatalog(fileKey, token);
      await figma.clientStorage.setAsync(STORAGE_CATALOG, catalog);
      var summary = {
        fileKey: catalog.fileKey, fileName: catalog.fileName,
        lastModified: catalog.lastModified, fetchedAt: catalog.fetchedAt,
        componentCount: catalog.components.length,
        componentSetCount: catalog.componentSets.length,
        styleCount: catalog.styles.length
      };
      await figma.clientStorage.setAsync(STORAGE_CATALOG_SUMMARY, summary);
      post('catalog-summary', { catalogSummary: summary });
      post('catalog', { catalog: catalog });
      post('status', { message: 'Fetched ' + catalog.components.length + ' components, ' + catalog.componentSets.length + ' sets, ' + catalog.styles.length + ' styles.' });
    } else if (msg.type === 'load-cached-catalog') {
      var cachedCatalog = await figma.clientStorage.getAsync(STORAGE_CATALOG);
      post('catalog', { catalog: cachedCatalog || null });
      post('status', { message: cachedCatalog ? 'Loaded cached catalog.' : 'No cached catalog found.' });
    } else if (msg.type === 'rescan-attached') {
      var attached = await listAttached(msg.scope === 'file' ? 'file' : 'page');
      post('attached', { attached: attached });
      post('status', { message: 'Rescanned.' });
    } else if (msg.type === 'parse-files') {
      var parsed = await parseInstructions(msg.usageJson, msg.tsxText);
      post('parsed-instructions', parsed);
      post('status', { message: parsed.hasCatalog
        ? 'Parsed ' + parsed.instructions.length + ' instructions against cached catalog.'
        : 'Parsed but no catalog cached — fetch the library first.' });
    } else if (msg.type === 'build-screen') {
      post('status', { message: 'Building screen…' });
      var result = await buildScreen(msg);
      post('build-complete', result);
      post('status', { message: 'Placed ' + result.placed + ', missing ' + result.missing + '.' });
    } else if (msg.type === 'close') {
      figma.closePlugin();
    }
  } catch (e) {
    post('status', { message: 'Error: ' + (e && e.message ? e.message : String(e)) });
  }
};

bootstrap().catch(function (e) {
  post('status', { message: 'Error: ' + (e && e.message ? e.message : String(e)) });
});

