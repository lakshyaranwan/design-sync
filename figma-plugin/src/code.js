// Sen Money DS Mapper - Ground layer: enumerate attached libraries + components
figma.showUI(__html__, { width: 480, height: 600 });

function post(type, payload) {
  figma.ui.postMessage(Object.assign({ type: type }, payload || {}));
}

function ensureLibrary(result, name) {
  if (!result.librariesByName[name]) {
    result.librariesByName[name] = { variableCollections: 0, components: 0 };
  }
}

async function getAvailableLibraryComponents() {
  const teamLibrary = figma.teamLibrary;
  const componentApi = teamLibrary && (teamLibrary.getAvailableComponentsAsync || teamLibrary.getAvailableLibraryComponentsAsync);

  if (!componentApi) {
    throw new Error('No Team Library component enumeration API is available in this Figma runtime.');
  }

  return componentApi.call(teamLibrary);
}

async function listLibraries() {
  post('status', { message: 'Reading attached libraries...' });

  const result = {
    variableCollections: [],
    components: [],
    librariesByName: {},
    errors: []
  };

  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    result.variableCollections = collections.map(function (collection) {
      return {
        key: collection.key,
        name: collection.name,
        libraryName: collection.libraryName
      };
    });

    collections.forEach(function (collection) {
      ensureLibrary(result, collection.libraryName);
      result.librariesByName[collection.libraryName].variableCollections += 1;
    });
  } catch (e) {
    result.errors.push('Variable collections: ' + (e && e.message ? e.message : String(e)));
  }

  try {
    const components = await getAvailableLibraryComponents();
    result.components = components.map(function (component) {
      return {
        key: component.key,
        name: component.name,
        libraryName: component.libraryName,
        description: component.description || ''
      };
    });

    components.forEach(function (component) {
      ensureLibrary(result, component.libraryName);
      result.librariesByName[component.libraryName].components += 1;
    });
  } catch (e) {
    result.errors.push('Components: ' + (e && e.message ? e.message : String(e)));
  }

  post('libraries', { data: result });
  post('status', { message: 'Done.' });
}

figma.ui.onmessage = function (msg) {
  if (msg.type === 'scan') {
    listLibraries().catch(function (e) {
      post('status', { message: 'Error: ' + (e && e.message ? e.message : String(e)) });
    });
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

listLibraries().catch(function (e) {
  post('status', { message: 'Error: ' + (e && e.message ? e.message : String(e)) });
});