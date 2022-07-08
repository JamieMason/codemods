import { getNameInCamelCase, getNameInPascalCase } from './lib/file';
import { extendApi } from './lib/helpers';

export default (file, api) => {
  const j = api.jscodeshift;
  const f = j(file.source);

  extendApi(j);

  if (f.find(j.ExportDefaultDeclaration).length === 0) {
    console.log(`%s has no default export`, file.path);
    return;
  }

  const topLevelVarNames = f.getTopLevelVarNames();
  const usesReact = f.getImportsByPackageName('react').length > 0;
  const intendedName = usesReact ? getNameInPascalCase(file) : getNameInCamelCase(file);
  const caseInsensitiveMatch = (name) => name?.toLowerCase() === intendedName?.toLowerCase();
  const existingName = topLevelVarNames.find(caseInsensitiveMatch);
  const nameIsInUse = Boolean(existingName);
  const exportName = existingName || intendedName;

  if (!nameIsInUse) {
    return f
      .find(j.ExportDefaultDeclaration)
      .insertBefore((path) => f.exportDefaultAsNamed(path, exportName))
      .replaceWith('')
      .toSource();
  }

  const classExportOfName = f.getExportsByClassName(exportName);
  const functionExportOfName = f.getExportsByFunctionName(exportName);
  const namedExportOfName = f.getExportsByVarName(exportName);
  const matchingClass = f.getTopLevelClassByName(exportName);
  const matchingFunction = f.getTopLevelFunctionByName(exportName);
  const matchingVariable = f.getTopLevelVariableByName(exportName);

  if (classExportOfName.length > 0) {
    console.log(`%s already exports a class called %s`, file.path, exportName);
    return;
  }

  if (functionExportOfName.length > 0) {
    console.log(`%s already exports a function called %s`, file.path, exportName);
    return;
  }

  if (namedExportOfName.length > 0) {
    console.log(`%s already exports a const called %s`, file.path, exportName);
    return;
  }

  if (matchingClass.length > 0) {
    console.log(`%s has a class called %s which is not exported`, file.path, exportName);
    matchingClass.replaceWith(() => f.exportClass(matchingClass.get()));

    return f.removeDefaultExport().toSource();
  }

  if (matchingFunction.length > 0) {
    console.log(`%s has a function called %s which is not exported`, file.path, exportName);
    matchingFunction.replaceWith(() => f.exportFunction(matchingFunction.get()));

    return f.removeDefaultExport().toSource();
  }

  if (matchingVariable.length > 0) {
    console.log(`%s has a variable called %s which is not exported`, file.path, exportName);

    matchingVariable.replaceWith(() => f.exportVariable(matchingVariable.get()));

    return f.removeDefaultExport().toSource();
  }

  if (nameIsInUse) {
    let importReplaced = false;

    f.find(j.ExportDefaultDeclaration)
      .insertBefore((path) => f.exportDefaultAsNamed(path, exportName))
      .replaceWith('');

    f.find(j.ImportDeclaration).forEach((path) => {
      const importDeclaration = path.value;

      importDeclaration.specifiers = importDeclaration.specifiers.map((specifier) => {
        if (
          specifier.local.name.toLowerCase() === intendedName.toLowerCase() &&
          importDeclaration.source.value.startsWith('@dhl')
        ) {
          importReplaced = true;
          return j.importSpecifier(j.identifier(`${intendedName} as Dhl${intendedName}`));
        } else {
          return specifier;
        }
      });
    });

    if (importReplaced) {
      f.find(j.JSXIdentifier)
        .filter((path) => path.value.name.toLowerCase() === intendedName.toLowerCase())
        .forEach((path) => {
          const declaration = path.value;
          declaration.name = `Dhl${intendedName}`;
        });
    }

    return f.toSource();
  }
};
