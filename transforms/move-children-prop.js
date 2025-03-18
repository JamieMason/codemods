export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  return root
    .find(j.JSXElement)
    .forEach((path) => {
      // Find elements with a children prop
      const childrenProp = path.value.openingElement.attributes.find(
        (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'children',
      );

      if (!childrenProp) return;

      // Store the value of the children prop
      const childrenValue = childrenProp.value;

      // Remove the children prop
      path.value.openingElement.attributes = path.value.openingElement.attributes.filter(
        (attr) => attr.name && attr.name.name !== 'children',
      );

      // Make sure the element has a closing tag
      if (path.value.openingElement.selfClosing) {
        path.value.openingElement.selfClosing = false;
        path.value.closingElement = j.jsxClosingElement(j.jsxIdentifier(path.value.openingElement.name.name));
      }

      // Add the children expression between the opening and closing tags
      if (childrenValue.type === 'JSXExpressionContainer') {
        path.value.children = [childrenValue];
      } else if (childrenValue.type === 'StringLiteral') {
        path.value.children = [j.jsxText(childrenValue.value)];
      } else {
        path.value.children = [j.jsxExpressionContainer(childrenValue)];
      }
    })
    .toSource();
};
