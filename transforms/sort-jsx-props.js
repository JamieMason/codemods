export default (file, api) => {
  const j = api.jscodeshift;
  const getPropName = jsxAttribute => (jsxAttribute.name ? jsxAttribute.name.name : '...spread');
  const sortByPropName = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  };

  return j(file.source)
    .find(api.jscodeshift.JSXOpeningElement)
    .forEach(path => {
      const jSXOpeningElement = path.value;
      jSXOpeningElement.attributes = jSXOpeningElement.attributes.sort((a, b) =>
        sortByPropName(getPropName(a), getPropName(b))
      );
    })
    .toSource();
};
