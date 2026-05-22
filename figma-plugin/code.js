// Sen Money DS Mapper - Ground layer: enumerate attached libraries + component usage
figma.showUI(__html__, { width: 520, height: 680 });

function post(type, payload) {
  figma.ui.postMessage(Object.assign({ type: type }, payload || {}));
}

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

async function getEnumeratedLibraryComponents(result) {
  var teamLibrary = figma.teamLibrary;
  var componentApi = teamLibrary && (teamLibrary.getAvailableComponentsAsync || teamLibrary.getAvailableLibraryComponentsAsync);
  if (!componentApi) {
    result.notes.push('This Figma runtime does not expose full Team Library component enumeration. The plugin is showing components already used in this file instead.');
    return [];
  }
  return componentApi.call(teamLibrary);
}

async function scanUsedComponents() {
  if (typeof figma.loadAllPagesAsync === 'function') {
    await figma.loadAllPagesAsync();
  }

  var instances = figma.root.findAll(function (node) { return node.type === 'INSTANCE'; });
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
      byKey[key] = {
        key: key,
        name: name,
        remote: !!main.remote,
        instanceCount: 0,
        variantsByName: {},
        pagesByName: {}
      };
    }

    byKey[key].instanceCount += 1;
    byKey[key].pagesByName[page] = true;
    if (variant) byKey[key].variantsByName[variant] = true;
  }

  return Object.keys(byKey).map(function (key) {
    var item = byKey[key];
    return {
      key: item.key,
      name: item.name,
      remote: item.remote,
      instanceCount: item.instanceCount,
      variants: Object.keys(item.variantsByName).sort(),
      pages: Object.keys(item.pagesByName).sort()
    };
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });
}

async function listLibraries() {
  post('status', { message: 'Reading libraries and component usage...' });

  var result = {
    variableCollections: [],
    components: [],
    usedComponents: [],
    librariesByName: {},
    notes: [],
    errors: []
  };

  try {
    var collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    result.variableCollections = collections.map(function (collection) {
      return { key: collection.key, name: collection.name, libraryName: collection.libraryName };
    });
    collections.forEach(function (collection) {
      ensureLibrary(result, collection.libraryName);
      result.librariesByName[collection.libraryName].variableCollections += 1;
    });
  } catch (e) {
    result.errors.push('Variable collections: ' + (e && e.message ? e.message : String(e)));
  }

  try {
    var components = await getEnumeratedLibraryComponents(result);
    result.components = components.map(function (component) {
      return {
        key: component.key,
        name: component.name,
        libraryName: component.libraryName || 'Unknown library',
        description: component.description || ''
      };
    });
    result.components.forEach(function (component) {
      ensureLibrary(result, component.libraryName);
      result.librariesByName[component.libraryName].components += 1;
    });
  } catch (e) {
    result.errors.push('Components: ' + (e && e.message ? e.message : String(e)));
  }

  try {
    result.usedComponents = await scanUsedComponents();
  } catch (e) {
    result.errors.push('Used component scan: ' + (e && e.message ? e.message : String(e)));
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
