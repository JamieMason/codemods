export default function transformer(file, api) {
  const j = api.jscodeshift;

  return j(file.source)
    .find(j.JSXElement)
    .forEach((path) => {
      const jsxElement = path.value;
      const jSXOpeningElement = path.value.openingElement;
      const localName = jSXOpeningElement.name.name;

      if (localName !== 'IconWithTheme') return;

      const iconElement = jsxElement.children.find((child) => {
        return (
          child.type === 'JSXElement' &&
          child.openingElement &&
          child.openingElement.name &&
          child.openingElement.name.name === 'Icon'
        );
      });

      if (!iconElement) return;

      j(path).replaceWith(iconElement);
    })
    .toSource();
}
