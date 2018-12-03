export default (file, api) => {
  const j = api.jscodeshift;
  const regex = { filePath: /.+\/+/, extensions: /\..+/, nonCamelCasing: /[-_ ]([a-z])/g };
  let fileName = file.path
    .replace('/index', '')
    .replace(regex.filePath, '')
    .replace(regex.extensions, '')
    .replace(regex.nonCamelCasing, $1 => $1.charAt(1).toUpperCase());

  return j(file.source)
    .find(j.ExportDefaultDeclaration)
    .insertBefore(path => {
      const exportDefaultDeclaration = path.value;
      const exportedValue = exportDefaultDeclaration.declaration;
      const exportedValueAsConstant = j.variableDeclaration('const', [
        j.variableDeclarator(j.identifier(fileName), exportedValue)
      ]);
      const namedExport = j.exportNamedDeclaration(exportedValueAsConstant);
      return namedExport;
    })
    .replaceWith(() => {
      const defaultExport = j.exportDefaultDeclaration(j.identifier(fileName));
      return defaultExport;
    })
    .toSource();
};
