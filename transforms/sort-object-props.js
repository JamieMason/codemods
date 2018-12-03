export default (file, api) => {
  const j = api.jscodeshift;
  const getPropName = property => (property.key && (property.key.name || property.key.value)) || '';
  const sortByPropName = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  };

  return j(file.source)
    .find(api.jscodeshift.ObjectExpression)
    .forEach(path => {
      const objectExpression = path.value;
      objectExpression.properties = objectExpression.properties.sort((a, b) =>
        sortByPropName(getPropName(a), getPropName(b))
      );
    })
    .toSource();
};
