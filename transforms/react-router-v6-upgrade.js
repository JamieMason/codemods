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
      .filter((specifier) => !['RouteComponentProps', 'RouteChildrenProps'].includes(specifier.local.name))
      .map((specifier) => {
        const newImportName = renamedImportsMap[specifier.local.name];
        if (newImportName) {
          return j.importSpecifier(j.identifier(newImportName));
        }

        return specifier;
      });
  });

  /*
   * When a component uses RouteComponentProps as the base for its Prop type, attempt to migrate it
   * to using the respective useLocation and useParams hooks. This mod will try to construct useParams
   * in such a way that it uses the same object destructuring as was used in `match` of RouteComponentProps.
   * The custom props type based on RouteComponentProps and props passed to component will be removed.
   */
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

    j(path).remove();
  });

  const objectPatternUsingRouteComponentPropsType = (value) =>
    value.params[0] &&
    value.params[0].type === 'ObjectPattern' &&
    [propsTypeName, 'RouteComponentProps', 'RouteChildrenProps'].includes(
      value.params[0]?.typeAnnotation?.typeAnnotation?.typeName?.name,
    );

  const convertArrowFunctionExpression = (value) => {
    const conditionallyConvertToBlockStatement = () => {
      if (!value.body.body) {
        // convert to block statement
        value.body = j.blockStatement([j.returnStatement(value.body)]);
      }
    };

    useParamsTypeParam = useParamsTypeParam || value.params[0]?.typeAnnotation?.typeAnnotation.typeParameters;

    const matchProp = value.params[0].properties.find((p) => p.key.name === 'match');

    if (useParamsTypeParam || matchProp) {
      let objectBinding = undefined;
      let addUseParam = false;

      if (matchProp && matchProp.value.properties) {
        objectBinding = matchProp.value.properties[0].value;
        addUseParam = true;
      } else if (matchProp && !matchProp.value.properties) {
        f.find(j.MemberExpression, {
          object: {
            name: 'match',
          },
          property: {
            name: 'params',
          },
        }).replaceWith((path) => {
          addUseParam = true;
          return path.value.property;
        });
      }

      if (addUseParam) {
        const declaration = objectBinding ? objectBinding : j.identifier('params');

        const useParamsDeclaration = j.variableDeclaration('const', [
          j.variableDeclarator(declaration, j.callExpression(j.identifier('useParams'), [])),
        ]);

        useParamsDeclaration.declarations[0].init.typeParameters = useParamsTypeParam;

        conditionallyConvertToBlockStatement();
        value.body.body = [useParamsDeclaration, ...value.body.body];

        f.addImportToPackageName('react-router-dom', 'useParams');
      }
    } else {
    }

    const historyProp = value.params[0].properties.find((p) => p.key.name === 'history');

    if (historyProp) {
      const useNavigateDeclaration = j.variableDeclaration('const', [
        j.variableDeclarator(j.identifier('navigate'), j.callExpression(j.identifier('useNavigate'), [])),
      ]);

      conditionallyConvertToBlockStatement();
      value.body.body = [useNavigateDeclaration, ...value.body.body];
      f.addImportToPackageName('react-router-dom', 'useNavigate');
    }

    const locationProp = value.params[0].properties.find((p) => p.key.name === 'location');

    if (locationProp) {
      const useLocationDeclaration = j.variableDeclaration('const', [
        j.variableDeclarator(j.identifier('location'), j.callExpression(j.identifier('useLocation'), [])),
      ]);

      conditionallyConvertToBlockStatement();
      value.body.body = [useLocationDeclaration, ...value.body.body];
      f.addImportToPackageName('react-router-dom', 'useLocation');
    }

    value.params[0].properties = value.params[0].properties.filter((p) => routeComponentProperties.includes(p.key));

    if (value.params[0].properties.length === 0) {
      value.params = [];
    }
  };

  f.find(j.VariableDeclaration)
    .filter(
      (path) =>
        propsTypeName &&
        path.value.declarations[0]?.id?.typeAnnotation?.typeAnnotation?.typeParameters?.params[0]?.typeName?.name ===
          propsTypeName,
    )
    .forEach((path, i) => {
      const value = path.value;
      convertArrowFunctionExpression(value.declarations[0].init);
      value.declarations[0].id.typeAnnotation.typeAnnotation.typeParameters = undefined;
    });

  f.find(j.ArrowFunctionExpression)
    .filter((path) => objectPatternUsingRouteComponentPropsType(path.value))
    .forEach((path) => convertArrowFunctionExpression(path.value));

  f.renameJSXElements('Switch', 'Routes');
  f.renameJSXElements('Redirect', 'Navigate');

  const createSelfClosingJsxElement = (name) => {
    const el = j.jsxOpeningElement(j.jsxIdentifier(name));
    el.selfClosing = true;
    return el;
  };

  const wrapWithExpressionContainer = (element) => j.jsxExpressionContainer(j.jsxElement(element));

  // Convert component and children attributes on Route to element attribute.
  f.find(j.JSXElement)
    .filter((path) => path.value.openingElement.name.name === 'Route')
    .forEach((path) => {
      const componentAttribute = path.value.openingElement.attributes.find((a) => a.name?.name === 'component');
      const childrenAttribute = path.value.openingElement.attributes.find((a) => a.name?.name === 'children');
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
        (a) => !['exact', 'strict'].includes(a.name?.name),
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
