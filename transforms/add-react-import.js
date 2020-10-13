export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  const containsJsx = root.find(j.JSXIdentifier).length > 0;

  const containsReactPackageImport =
    root.find(j.ImportDeclaration).filter((importDeclaration) => importDeclaration.node.source.value === 'react')
      .length > 0;

  const containsReactDefaultImport =
    root
      .find(j.ImportDefaultSpecifier)
      .filter((importDefaultSpecifier) => importDefaultSpecifier.node.local.name === 'React').length > 0;

  if (containsJsx && !(containsReactPackageImport && containsReactDefaultImport)) {
    root
      .get()
      .node.program.body.unshift(
        j.importDeclaration([j.importDefaultSpecifier(j.identifier('React'))], j.literal('react')),
      );
  }

  return root.toSource();
};
