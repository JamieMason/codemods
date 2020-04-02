export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  const containsJsx = root.find(j.JSXIdentifier).length > 0;

  const containsReactImport =
    root.find(j.ImportDeclaration).filter((importDeclaration) => importDeclaration.node.source.value === 'react')
      .length > 0;

  if (containsJsx && !containsReactImport) {
    root
      .get()
      .node.program.body.unshift(
        j.importDeclaration([j.importDefaultSpecifier(j.identifier('React'))], j.literal('react')),
      );
  }

  return root.toSource();
};
