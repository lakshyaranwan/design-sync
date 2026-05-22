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
  post('status', { message: 'Fetched ' + styles.length + ' styles. Fetching file metadata...' });

  var fileMeta = await figmaApi('/v1/files/' + fileKey + '?depth=1', token);

  return {
    fileKey: fileKey,
    fileName: fileMeta.name || 'Unknown file',
    lastModified: fileMeta.lastModified || null,
    fetchedAt: new Date().toISOString(),
    components: components.map(function (c) {
      return {
        key: c.key, name: c.name, description: c.description || '',
        containingFrame: c.containing_frame || null,
        componentSetId: c.component_set_id || null
      };
    }),
    componentSets: componentSets.map(function (s) {
      return { key: s.key, name: s.name, description: s.description || '', containingFrame: s.containing_frame || null };
    }),
    styles: styles.map(function (s) {
      return { key: s.key, name: s.name, styleType: s.style_type, description: s.description || '' };
    })
  };
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
        fileKey: catalog.fileKey,
        fileName: catalog.fileName,
        lastModified: catalog.lastModified,
        fetchedAt: catalog.fetchedAt,
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
