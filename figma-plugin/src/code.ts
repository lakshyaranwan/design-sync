// Sen Money DS Mapper - Ground layer: enumerate attached libraries + components
figma.showUI(__html__, { width: 480, height: 600 });

type LibrarySummary = {
  variableCollections: number;
  components: number;
};

type LibraryScanResult = {
  variableCollections: Array<{ key: string; name: string; libraryName: string }>;
  components: Array<{ key: string; name: string; libraryName: string; description: string }>;
  librariesByName: Record<string, LibrarySummary>;
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

async function getAvailableLibraryComponents(): Promise<any[]> {
  const teamLibrary = (figma as any).teamLibrary;
  const componentApi =
    teamLibrary &&
    (teamLibrary.getAvailableComponentsAsync || teamLibrary.getAvailableLibraryComponentsAsync);

  if (!componentApi) {
    throw new Error('No Team Library component enumeration API is available in this Figma runtime.');
  }

  return componentApi.call(teamLibrary);
}

async function listLibraries() {
  post('status', { message: 'Reading attached libraries...' });

  const result: LibraryScanResult = {
    variableCollections: [],
    components: [],
    librariesByName: {},
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
    const components = await getAvailableLibraryComponents();
    result.components = components.map((component) => ({
      key: component.key,
      name: component.name,
      libraryName: component.libraryName,
      description: component.description || '',
    }));

    components.forEach((component) => {
      ensureLibrary(result, component.libraryName);
      result.librariesByName[component.libraryName].components += 1;
    });
  } catch (e) {
    result.errors.push('Components: ' + ((e as Error).message || e));
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