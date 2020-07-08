export default (file, api) => {
  const j = api.jscodeshift;
  const removePath = (path) => j(path).remove();
  const isAssigningDefaultProps = (e) =>
    e.node.left && e.node.left.property && e.node.left.property.name === 'defaultProps';

  const withoutAssignment = j(file.source)
    .find(j.AssignmentExpression)
    .filter(isAssigningDefaultProps)
    .forEach(removePath)
    .toSource();

  return withoutAssignment;
};
