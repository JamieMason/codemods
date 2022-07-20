import { extendApi } from './lib/helpers';

export default (file, api) => {
  const j = api.jscodeshift;
  const f = j(file.source);

  extendApi(j);

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

  const routeComponentProperties = ['history', 'location', 'match'];

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

  let propsTypeName = '';
  let useParamsTypeParam = undefined;

  f.find(j.TSTypeAliasDeclaration, {
    typeAnnotation: {
      typeName: {
        name: 'RouteComponentProps',
      },
    },
  }).forEach((path) => {
    const declaration = path.value;

    propsTypeName = path.value.id.name;
    useParamsTypeParam = declaration.typeAnnotation.typeParameters;
  });

  f.find(j.ArrowFunctionExpression)
    .filter((path) => path.value.params[0] && path.value.params[0].type === 'ObjectPattern')
    .filter(
      (path) =>
        path.value.params[0].typeAnnotation &&
        path.value.params[0].typeAnnotation.typeAnnotation &&
        path.value.params[0].typeAnnotation.typeAnnotation.typeName &&
        path.value.params[0].typeAnnotation.typeAnnotation.typeName.name === propsTypeName,
    )
    .forEach((path) => {
      const value = path.value;

      if (useParamsTypeParam) {
        const useParamsDeclaration = j.variableDeclaration('const', [
          j.variableDeclarator(j.identifier('params'), j.callExpression(j.identifier('useParams'), [])),
        ]);

        useParamsDeclaration.declarations[0].init.typeParameters = useParamsTypeParam;

        value.body.body = [useParamsDeclaration, ...value.body.body];

        f.addImportToPackageName('react-router-dom', 'useParams');
      }

      const historyProp = path.value.params[0].properties.find((p) => p.key.name === 'history');

      if (historyProp) {
        const useNavigateDeclaration = j.variableDeclaration('const', [
          j.variableDeclarator(j.identifier('navigate'), j.callExpression(j.identifier('useNavigate'), [])),
        ]);
        value.body.body = [useNavigateDeclaration, ...value.body.body];
        f.addImportToPackageName('react-router-dom', 'useNavigate');
      }

      const matchProp = path.value.params[0].properties.find((p) => p.key.name === 'match');

      if (matchProp) {
        console.log(matchProp.value.properties[0].value);
      }

      value.params[0].properties = value.params[0].properties.filter((p) => routeComponentProperties.includes(p.key));

      if (value.params[0].properties.length === 0) {
        value.params = [];
      }
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
};
