export default (file, api) => {
  function removePath(path) {
    return j(path).remove();
  }

  function isDefaultPropsAssignment(path) {
    return path.node.left && path.node.left.property && path.node.left.property.name === 'defaultProps';
  }

  const j = api.jscodeshift;
  const original = j(file.source);
  const defaultPropsAssignment = original.find(j.AssignmentExpression).filter(isDefaultPropsAssignment);

  if (defaultPropsAssignment.length === 0) {
    return;
  }

  if (defaultPropsAssignment.length > 1) {
    return console.log('SKIPPED: Multiple components in one file', file.path);
  }

  const defaultPropsProperties = defaultPropsAssignment.find(j.ObjectExpression).get('properties');

  if (!defaultPropsProperties.value.length) {
    return;
  }

  const componentName = defaultPropsAssignment.get(0).node.left.object.name;
  // const componentAsFunctionDeclaration = original.find(j.FunctionDeclaration, { id: { name: componentName } });
  const variableDeclarationWithComponentName = original.find(j.VariableDeclarator, { id: { name: componentName } });

  // console.log({ keyValuePairs: defaultPropsProperties }, defaultPropsProperties.length);
  // console.log({ componentName });
  // console.log({ defaultedPropNames });

  if (variableDeclarationWithComponentName.length > 0) {
    const init = variableDeclarationWithComponentName.get(0).node.init;
    if (!init.params) {
      return console.log('SKIPPED: No params', file.path);
    }
    const propsArgument = init.params[0];
    const propsAreDeconstructedObject = propsArgument.type === 'ObjectPattern';
    if (propsAreDeconstructedObject) {
      propsArgument.properties.forEach((prop) => {
        if (!prop.key || prop.value.type === 'AssignmentPattern') return;
        defaultPropsProperties.value.forEach((defaultProp) => {
          if (defaultProp.key.name === prop.key.name) {
            prop.value = j.assignmentPattern.from({
              left: prop.value,
              right: defaultProp.value,
            });
          }
        });
      });
    }
  }

  // const { a, b } = this.props;
  original
    .find(j.VariableDeclarator, {
      id: {
        type: 'ObjectPattern',
      },
      init: {
        type: 'MemberExpression',
        object: {
          type: 'ThisExpression',
        },
        property: {
          name: 'props',
        },
      },
    })
    .forEach((path) => {
      const properties = path.value.id.properties;
      properties.forEach((prop) => {
        if (!prop.key || prop.value.type === 'AssignmentPattern') return;
        defaultPropsProperties.value.forEach((defaultProp) => {
          if (defaultProp.key.name === prop.key.name) {
            prop.value = j.assignmentPattern.from({
              left: prop.value,
              right: defaultProp.value,
            });
          }
        });
      });
    });

  defaultPropsAssignment.forEach(removePath);

  return original.toSource();
};
