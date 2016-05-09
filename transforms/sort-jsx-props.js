module.exports = function (file, api) {
  var root = api.jscodeshift(file.source);

  root.find(api.jscodeshift.JSXOpeningElement)
    .forEach(sortJSXProps);

  return root.toSource();
};

function sortJSXProps (node) {
  node.value.attributes = node.value.attributes.sort(sortJSXPropsByName);
}

function sortJSXPropsByName (a, b) {
  return applySort(getPropNameForSort(a), getPropNameForSort(b));
}

function getPropNameForSort (attr) {
  return attr.name ? attr.name.name : '...spread';
}

function applySort (a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
