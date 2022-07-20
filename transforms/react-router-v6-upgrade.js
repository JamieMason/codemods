import { getNameInCamelCase, getNameInPascalCase } from './lib/file';
import { extendApi } from './lib/helpers';

export default (file, api) => {
  const j = api.jscodeshift;
  const f = j(file.source);

  extendApi(j);

  const topLevelVarNames = f.getTopLevelVarNames();
  const reactRouterImports = f.getImportsByPackageName('react-router-dom');
  const usesReactRouter = reactRouterImports.length > 0;

  if (!usesReactRouter) {
    console.log(`${file.path} has no imports from react-router-dom`);
    return;
  }

  const renamedImportsMap = {
    Switch: 'Routes',
    Redirect: 'Navigate',
    useHistory: 'useNavigate',
  };

  reactRouterImports.forEach((path) => {
    const importDeclaration = path.value;

    importDeclaration.specifiers = importDeclaration.specifiers
      .filter((specifier) => !['RouteComponentProps'].includes(specifier.local.name))
      .map((specifier) => {
        const newImportName = renamedImportsMap[specifier.local.name];
        if (newImportName) {
          return j.importSpecifier(j.identifier(newImportName));
        }

        return specifier;
      });
  });

  f.renameJSXElements('Switch', 'Routes');
  f.renameJSXElements('Redirect', 'Navigate');

  const createSelfClosingJsxElement = (name) => {
    const el = j.jsxOpeningElement(j.jsxIdentifier(name));
    el.selfClosing = true;
    return el;
  };

  const wrapWithExpressionContainer = (element) => j.jsxExpressionContainer(j.jsxElement(element));

  f.find(j.JSXElement)
    .filter((path) => path.value.openingElement.name.name === 'Route')
    .forEach((path) => {
      const componentAttribute = path.value.openingElement.attributes.find((a) => a.name.name === 'component');
      const childrenAttribute = path.value.openingElement.attributes.find((a) => a.name.name === 'children');
      if (componentAttribute) {
        componentAttribute.name = 'element';
        if (componentAttribute.value.expression.type === 'Identifier') {
          componentAttribute.value = wrapWithExpressionContainer(
            createSelfClosingJsxElement(componentAttribute.value.expression.name),
          );
        } else if (componentAttribute.value.expression.type === 'ConditionalExpression') {
          componentAttribute.value.expression.consequent = createSelfClosingJsxElement(
            componentAttribute.value.expression.consequent.name,
          );
          componentAttribute.value.expression.alternate = createSelfClosingJsxElement(
            componentAttribute.value.expression.alternate.name,
          );
        }
      } else if (childrenAttribute) {
        childrenAttribute.name = 'element';
        if (
          childrenAttribute.value.expression.body.type === 'BlockStatement' &&
          childrenAttribute.value.expression.body.body[0].type === 'ReturnStatement'
        ) {
          const returnArg = childrenAttribute.value.expression.body.body[0].argument;

          childrenAttribute.value = j.jsxExpressionContainer(returnArg);
        } else if (childrenAttribute.value.expression.body.type === 'JSXElement') {
          childrenAttribute.value = j.jsxExpressionContainer(childrenAttribute.value.expression.body);
        }
      }

      path.value.openingElement.attributes = path.value.openingElement.attributes.filter(
        (a) => !['exact'].includes(a.name.name),
      );
    });

  f.find(j.Identifier)
    .filter((path) => path.value.name === 'useHistory')
    .forEach((path) => {
      path.value.name = 'useNavigate';
    });

  f.find(j.Identifier)
    .filter((path) => path.value.name === 'useRouteMatch')
    .forEach((path) => {
      path.value.name = 'useMatch';
    });

  f.find(j.Identifier)
    .filter((path) => path.value.name === 'history')
    .forEach((path) => {
      path.value.name = 'navigate';
    });

  f.find(j.CallExpression)
    .filter(
      (path) =>
        path.value.callee.type === 'MemberExpression' &&
        path.value.callee.object.name === 'navigate' &&
        (path.value.callee.property.name === 'push' || path.value.callee.property.name === 'replace'),
    )
    .forEach((path) => {
      if (path.value.arguments.length > 1) {
        const stateArg = path.value.arguments[1];

        const stateObject = j.objectExpression([j.property('init', j.identifier('state'), stateArg)]);

        path.value.arguments[1] = stateObject;
      } else if (path.value.arguments.length === 1 && path.value.arguments[0].type === 'ObjectExpression') {
        const arg = path.value.arguments[0];
        const pathPropertyValue = arg.properties.find((p) => p.key.name === 'pathname').value;
        const stateProperty = arg.properties.find((p) => p.key.name === 'state');

        if (stateProperty) {
          path.value.arguments = [
            pathPropertyValue,
            j.objectExpression([j.property('init', j.identifier('state'), stateProperty.value)]),
          ];
        } else {
          path.value.arguments = [pathPropertyValue];
        }
      }

      path.value.callee = 'navigate';
    });

  if (file.path.includes('Routes.tsx')) {
    const routesNamedExport = f
      .find(j.ExportNamedDeclaration)
      .filter(
        (path) => path.value.declaration.declarations && path.value.declaration.declarations[0].id.name === 'Routes',
      );

    if (routesNamedExport.length > 0) {
      f.find(j.ImportDeclaration).forEach((path) => {
        const importDeclaration = path.value;
        //console.log(importDeclaration.specifiers)

        const routesImport = importDeclaration.specifiers.find((s) => s.imported && s.imported.name === 'Routes');

        if (routesImport) {
          routesImport.imported.name = 'Routes as RouterRoutes';

          f.find(j.JSXIdentifier)
            .filter((path) => path.value.name === 'Routes')
            .forEach((path) => {
              const declaration = path.value;
              declaration.name = `RouterRoutes`;
            });
        }
      });
    }
  }

  return f.toSource();

  /*
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
  */
};
