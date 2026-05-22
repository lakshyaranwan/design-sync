// Sen Money DS Mapper - Ground layer: enumerate attached libraries + components
figma.showUI(__html__, { width: 480, height: 600 });

function post(type, payload) {
  figma.ui.postMessage(Object.assign({ type: type }, payload || {}));
}

async function listLibraries() {
  post('status', { message: 'Reading attached libraries...' });

  const result = {
    variableCollections: [],
    components: [],
    librariesByName: {},
    errors: []
  };

  // 1. Variable collections from enabled libraries
  try {
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    result.variableCollections = collections.map(function (c) {
      return {
        key: c.key,
        name: c.name,
        libraryName: c.libraryName
      };
    });
    collections.forEach(function (c) {
      if (!result.librariesByName[c.libraryName]) {
        result.librariesByName[c.libraryName] = { variableCollections: 0, components: 0 };
      }
      result.librariesByName[c.libraryName].variableCollections++;
    });
  } catch (e) {
    result.errors.push('Variable collections: ' + (e && e.message ? e.message : String(e)));
  }

  // 2. Components from enabled libraries
  try {
    const components = await figma.teamLibrary.getAvailableLibraryComponentsAsync();
    result.components = components.map(function (c) {
      return {
        key: c.key,
        name: c.name,
        libraryName: c.libraryName,
        description: c.description || ''
      };
    });
    components.forEach(function (c) {
      if (!result.librariesByName[c.libraryName]) {
        result.librariesByName[c.libraryName] = { variableCollections: 0, components: 0 };
      }
      result.librariesByName[c.libraryName].components++;
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

// Auto-run on load
listLibraries().catch(function (e) {
  post('status', { message: 'Error: ' + (e && e.message ? e.message : String(e)) });
});
