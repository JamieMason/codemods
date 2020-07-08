export default (file, api) => {
  const j = api.jscodeshift;
  const removePath = (path) => j(path).remove();
  const isAssigningPropTypes = (e) =>
    e.node.left && e.node.left.property && e.node.left.property.name === 'propTypes';
  const isImportingFromPropTypes = (e) => e.node.source && e.node.source.value === 'prop-types';
  const isRequiringFromPropTypes = (e) =>
    e.node.init &&
    e.node.init.callee &&
    e.node.init.callee.name === 'require' &&
    e.node.init.arguments[0].value === 'prop-types';

  const withoutAssignment = j(file.source)
    .find(j.AssignmentExpression)
    .filter(isAssigningPropTypes)
    .forEach(removePath)
    .toSource();

  const withoutImport = j(withoutAssignment)
    .find(j.ImportDeclaration)
    .filter(isImportingFromPropTypes)
    .forEach(removePath)
    .toSource();

  const withoutRequire = j(withoutImport)
    .find(j.VariableDeclarator)
    .filter(isRequiringFromPropTypes)
    .forEach(removePath)
    .toSource();

  return withoutRequire;
};
