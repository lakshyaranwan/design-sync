// Sen Money DS Mapper
// - Lightweight startup: no document scan and no full cached catalog render on load.
// - Fetches the full design system catalog from a Figma library file via REST API.

figma.showUI(__html__, { width: 560, height: 760 });

const STORAGE_TOKEN = 'figma_pat';
const STORAGE_LIBRARY_URL = 'library_file_url';
const STORAGE_CATALOG = 'library_catalog';
const STORAGE_CATALOG_SUMMARY = 'library_catalog_summary';

type LibrarySummary = { variableCollections: number; components: number };
type AttachedScan = {
  variableCollections: Array<{ key: string; name: string; libraryName: string }>;
  usedComponents: Array<{
    key: string;
    name: string;
    remote: boolean;
    instanceCount: number;
    variants: string[];
    pages: string[];
  }>;
  librariesByName: Record<string, LibrarySummary>;
  errors: string[];
  scope: 'page' | 'file';
};
type Catalog = {
  fileKey: string;
  fileName: string;
  lastModified: string | null;
  fetchedAt: string;
  components: Array<{ key: string; name: string; description: string; componentSetId: string | null }>;
  componentSets: Array<{ key: string; name: string; description: string }>;
  styles: Array<{ key: string; name: string; styleType: string; description: string }>;
};

function post(type: string, payload?: Record<string, unknown>) {
  figma.ui.postMessage(Object.assign({ type }, payload || {}));
}

function ensureLibrary(result: AttachedScan, name: string) {
  if (!result.librariesByName[name]) {
    result.librariesByName[name] = { variableCollections: 0, components: 0 };
  }
}

function getPageName(node: BaseNode): string {
  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE') current = current.parent;
  return current ? current.name : 'Unknown page';
}

function extractFileKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = String(url).match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

async function scanUsedComponents(scope: 'page' | 'file') {
  const root: PageNode | DocumentNode = scope === 'file' ? figma.root : figma.currentPage;
  if (scope === 'file' && typeof figma.loadAllPagesAsync === 'function') {
    await figma.loadAllPagesAsync();
  }
  const instances = root.findAll((node) => node.type === 'INSTANCE') as InstanceNode[];
  const byKey: Record<string, {
    key: string;
    name: string;
    remote: boolean;
    instanceCount: number;
    variantsByName: Record<string, true>;
    pagesByName: Record<string, true>;
  }> = {};

  for (const instance of instances) {
    let main: ComponentNode | null = null;
    try {
      main = instance.getMainComponentAsync ? await instance.getMainComponentAsync() : instance.mainComponent;
    } catch (e) {}
    if (!main) continue;
    const parentSet = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : null;
    const key = (parentSet && parentSet.key) || main.key || main.id;
    const name = parentSet ? parentSet.name : main.name;
    const variant = parentSet ? main.name : '';
    const page = getPageName(instance);
    if (!byKey[key]) {
      byKey[key] = { key, name, remote: Boolean(main.remote), instanceCount: 0, variantsByName: {}, pagesByName: {} };
    }
    byKey[key].instanceCount += 1;
    byKey[key].pagesByName[page] = true;
    if (variant) byKey[key].variantsByName[variant] = true;
  }

  return Object.keys(byKey).map((key) => {
    const item = byKey[key];
    return {
      key: item.key,
      name: item.name,
      remote: item.remote,
      instanceCount: item.instanceCount,
      variants: Object.keys(item.variantsByName).sort(),
      pages: Object.keys(item.pagesByName).sort(),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function listAttached(scope: 'page' | 'file'): Promise<AttachedScan> {
  const result: AttachedScan = { variableCollections: [], usedComponents: [], librariesByName: {}, errors: [], scope };
  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    result.variableCollections = collections.map((c) => ({ key: c.key, name: c.name, libraryName: c.libraryName }));
    collections.forEach((c) => {
      ensureLibrary(result, c.libraryName);
      result.librariesByName[c.libraryName].variableCollections += 1;
    });
  } catch (e) {
    result.errors.push('Variable collections: ' + ((e as Error).message || String(e)));
  }
  try {
    result.usedComponents = await scanUsedComponents(result.scope);
  } catch (e) {
    result.errors.push('Used component scan: ' + ((e as Error).message || String(e)));
  }
  return result;
}

async function figmaApi(path: string, token: string) {
  const res = await fetch('https://api.figma.com' + path, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch (e) {}
    throw new Error('Figma API ' + res.status + ': ' + (text || res.statusText));
  }
  return res.json();
}

async function fetchLibraryCatalog(fileKey: string, token: string): Promise<Catalog> {
  post('status', { message: 'Fetching components...' });
  const componentsResp = await figmaApi('/v1/files/' + fileKey + '/components', token);
  const components = (componentsResp.meta && componentsResp.meta.components) || [];
  post('status', { message: 'Fetched ' + components.length + ' components. Fetching component sets...' });

  const setsResp = await figmaApi('/v1/files/' + fileKey + '/component_sets', token);
  const componentSets = (setsResp.meta && setsResp.meta.component_sets) || [];
  post('status', { message: 'Fetched ' + componentSets.length + ' sets. Fetching styles...' });

  const stylesResp = await figmaApi('/v1/files/' + fileKey + '/styles', token);
  const styles = (stylesResp.meta && stylesResp.meta.styles) || [];
  post('status', { message: 'Fetched ' + styles.length + ' styles. Preparing catalog...' });

  return {
    fileKey,
    fileName: 'Library ' + fileKey,
    lastModified: null,
    fetchedAt: new Date().toISOString(),
    components: components.map((c: any) => ({
      key: c.key,
      name: c.name,
      description: c.description || '',
      componentSetId: c.component_set_id || null,
    })),
    componentSets: componentSets.map((s: any) => ({ key: s.key, name: s.name, description: s.description || '' })),
    styles: styles.map((s: any) => ({ key: s.key, name: s.name, styleType: s.style_type, description: s.description || '' })),
  };
}

async function bootstrap() {
  const token = await figma.clientStorage.getAsync(STORAGE_TOKEN);
  const libraryUrl = await figma.clientStorage.getAsync(STORAGE_LIBRARY_URL);
  const catalogSummary = await figma.clientStorage.getAsync(STORAGE_CATALOG_SUMMARY);
  post('init', { hasToken: Boolean(token), libraryUrl: libraryUrl || '', catalogSummary: catalogSummary || null, catalog: null, attached: null });
}

figma.ui.onmessage = async (msg) => {
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
      const token = await figma.clientStorage.getAsync(STORAGE_TOKEN);
      const libraryUrl = msg.libraryUrl || await figma.clientStorage.getAsync(STORAGE_LIBRARY_URL);
      if (!token) { post('status', { message: 'Missing personal access token.' }); return; }
      const fileKey = extractFileKey(libraryUrl);
      if (!fileKey) { post('status', { message: 'Invalid Figma file URL.' }); return; }
      if (libraryUrl) await figma.clientStorage.setAsync(STORAGE_LIBRARY_URL, libraryUrl);
      const catalog = await fetchLibraryCatalog(fileKey, token);
      await figma.clientStorage.setAsync(STORAGE_CATALOG, catalog);
      const summary = {
        fileKey: catalog.fileKey,
        fileName: catalog.fileName,
        lastModified: catalog.lastModified,
        fetchedAt: catalog.fetchedAt,
        componentCount: catalog.components.length,
        componentSetCount: catalog.componentSets.length,
        styleCount: catalog.styles.length,
      };
      await figma.clientStorage.setAsync(STORAGE_CATALOG_SUMMARY, summary);
      post('catalog-summary', { catalogSummary: summary });
      post('catalog', { catalog });
      post('status', { message: 'Fetched ' + catalog.components.length + ' components, ' + catalog.componentSets.length + ' sets, ' + catalog.styles.length + ' styles.' });
    } else if (msg.type === 'load-cached-catalog') {
      const cachedCatalog = await figma.clientStorage.getAsync(STORAGE_CATALOG);
      post('catalog', { catalog: cachedCatalog || null });
      post('status', { message: cachedCatalog ? 'Loaded cached catalog.' : 'No cached catalog found.' });
    } else if (msg.type === 'rescan-attached') {
      const attached = await listAttached(msg.scope === 'file' ? 'file' : 'page');
      post('attached', { attached });
      post('status', { message: 'Rescanned.' });
    } else if (msg.type === 'close') {
      figma.closePlugin();
    }
  } catch (e) {
    post('status', { message: 'Error: ' + ((e as Error).message || String(e)) });
  }
};

bootstrap().catch((e) => {
  post('status', { message: 'Error: ' + ((e as Error).message || String(e)) });
});