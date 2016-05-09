module.exports = function (file, api) {
  var root = api.jscodeshift(file.source);

  root
    .find(api.jscodeshift.ObjectExpression)
    .forEach(sortProps);

  return root.toSource();
};

function sortProps (node) {
	node.value.properties = node.value.properties.sort(sortPropsByName);
}

function sortPropsByName (a, b) {
  return applySort(getPropNameForSort(a), getPropNameForSort(b));
}

function getPropNameForSort (prop) {
  return prop.key ? prop.key.name : ''
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
