// Sen Money DS Mapper - Ground layer: enumerate attached libraries + component usage
figma.showUI(__html__, { width: 520, height: 680 });

type LibrarySummary = { variableCollections: number; components: number };
type LibraryComponent = { key: string; name: string; libraryName: string; description: string };
type UsedComponent = {
  key: string;
  name: string;
  remote: boolean;
  instanceCount: number;
  variants: string[];
  pages: string[];
};
type LibraryScanResult = {
  variableCollections: Array<{ key: string; name: string; libraryName: string }>;
  components: LibraryComponent[];
  usedComponents: UsedComponent[];
  librariesByName: Record<string, LibrarySummary>;
  notes: string[];
  errors: string[];
};

function post(type: string, payload?: Record<string, unknown>) {
  figma.ui.postMessage(Object.assign({ type }, payload || {}));
}

function ensureLibrary(result: LibraryScanResult, name: string) {
  if (!result.librariesByName[name]) {
    result.librariesByName[name] = { variableCollections: 0, components: 0 };
  }
}

function getPageName(node: BaseNode): string {
  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE') current = current.parent;
  return current ? current.name : 'Unknown page';
}

async function getEnumeratedLibraryComponents(result: LibraryScanResult): Promise<any[]> {
  const teamLibrary = (figma as any).teamLibrary;
  const componentApi =
    teamLibrary &&
    (teamLibrary.getAvailableComponentsAsync || teamLibrary.getAvailableLibraryComponentsAsync);

  if (!componentApi) {
    result.notes.push(
      'This Figma runtime does not expose full Team Library component enumeration. The plugin is showing components already used in this file instead.',
    );
    return [];
  }

  return componentApi.call(teamLibrary);
}

async function scanUsedComponents(): Promise<UsedComponent[]> {
  if (typeof figma.loadAllPagesAsync === 'function') {
    await figma.loadAllPagesAsync();
  }

  const instances = figma.root.findAll((node) => node.type === 'INSTANCE') as InstanceNode[];
  const byKey: Record<
    string,
    {
      key: string;
      name: string;
      remote: boolean;
      instanceCount: number;
      variantsByName: Record<string, true>;
      pagesByName: Record<string, true>;
    }
  > = {};

  for (const instance of instances) {
    let main: ComponentNode | null = null;
    try {
      main = instance.getMainComponentAsync
        ? await instance.getMainComponentAsync()
        : instance.mainComponent;
    } catch (e) {}
    if (!main) continue;

    const parentSet = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : null;
    const key = (parentSet && parentSet.key) || main.key || main.id;
    const name = parentSet ? parentSet.name : main.name;
    const variant = parentSet ? main.name : '';
    const page = getPageName(instance);

    if (!byKey[key]) {
      byKey[key] = {
        key,
        name,
        remote: Boolean(main.remote),
        instanceCount: 0,
        variantsByName: {},
        pagesByName: {},
      };
    }

    byKey[key].instanceCount += 1;
    byKey[key].pagesByName[page] = true;
    if (variant) byKey[key].variantsByName[variant] = true;
  }

  return Object.keys(byKey)
    .map((key) => {
      const item = byKey[key];
      return {
        key: item.key,
        name: item.name,
        remote: item.remote,
        instanceCount: item.instanceCount,
        variants: Object.keys(item.variantsByName).sort(),
        pages: Object.keys(item.pagesByName).sort(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listLibraries() {
  post('status', { message: 'Reading libraries and component usage...' });

  const result: LibraryScanResult = {
    variableCollections: [],
    components: [],
    usedComponents: [],
    librariesByName: {},
    notes: [],
    errors: [],
  };

  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    result.variableCollections = collections.map((collection) => ({
      key: collection.key,
      name: collection.name,
      libraryName: collection.libraryName,
    }));
    collections.forEach((collection) => {
      ensureLibrary(result, collection.libraryName);
      result.librariesByName[collection.libraryName].variableCollections += 1;
    });
  } catch (e) {
    result.errors.push('Variable collections: ' + ((e as Error).message || e));
  }

  try {
    const components = await getEnumeratedLibraryComponents(result);
    result.components = components.map((component) => ({
      key: component.key,
      name: component.name,
      libraryName: component.libraryName || 'Unknown library',
      description: component.description || '',
    }));
    result.components.forEach((component) => {
      ensureLibrary(result, component.libraryName);
      result.librariesByName[component.libraryName].components += 1;
    });
  } catch (e) {
    result.errors.push('Components: ' + ((e as Error).message || e));
  }

  try {
    result.usedComponents = await scanUsedComponents();
  } catch (e) {
    result.errors.push('Used component scan: ' + ((e as Error).message || e));
  }

  post('libraries', { data: result });
  post('status', { message: 'Done.' });
}

figma.ui.onmessage = (msg) => {
  if (msg.type === 'scan') {
    listLibraries().catch((e) => {
      post('status', { message: 'Error: ' + ((e as Error).message || e) });
    });
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

listLibraries().catch((e) => {
  post('status', { message: 'Error: ' + ((e as Error).message || e) });
});