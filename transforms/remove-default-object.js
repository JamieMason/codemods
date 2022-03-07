import { getNameInCamelCase, getNameInPascalCase } from './lib/file';
import { extendApi } from './lib/helpers';

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  return root
    .find(j.ExportDefaultDeclaration)
    .filter(
      (path) =>
        path.value &&
        path.value.declaration &&
        path.value.declaration.type &&
        path.value.declaration.type === 'ObjectExpression',
    )
    .forEach((path) => {
      path.value.declaration.properties = path.value.declaration.properties.filter((prop) => {
        if (prop.value.type === 'ArrowFunctionExpression') {
          const fn = j.functionDeclaration(j.identifier(prop.key.name), prop.value.params, prop.value.body);
          fn.async = prop.value.async;
          fn.expression = prop.value.expression;
          fn.generator = prop.value.generator;
          const namedExport = j.exportNamedDeclaration(fn);
          j(path).insertBefore(namedExport);
          return false;
        }
        return true;
      });
      if (path.value.declaration.properties.length === 0) {
        j(path).remove();
      }
    })
    .toSource();
};
