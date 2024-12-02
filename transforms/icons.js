import { dirname, relative, resolve } from 'path';

export default (file, api) => {
  const j = api.jscodeshift;
  const filePath = resolve(__dirname, file.path);
  const ignore = [
    '/Users/foldleft/Dev/codemods/Pitchero/ClubWebsiteJS/components/every-icon.jsx',
    '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/every-icon.jsx',
    '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/rank-ribbon/index.jsx',
    '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/team/profile/cricket-stats.jsx',
    '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/match-centre/match-event-icon.jsx',
    '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/club-frame/footer/club-footer/social-icon.jsx',
    '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/information/homepage.jsx',
  ];

  if (ignore.includes(filePath)) {
    console.log('ignored', filePath);
    return file.source;
  }

  const fileDirPath = dirname(filePath);
  const iconModulePath = '/Users/foldleft/Dev/Pitchero/ClubWebsiteJS/components/icon';
  const actualNamesByLocalName = {};

  const withUpdatedIconImports = j(file.source)
    .find(j.ImportDeclaration)
    .filter(
      (path) =>
        path.value &&
        path.value.source &&
        path.value.source.value &&
        path.value.source.value.startsWith('@pitchero/react-ui/dist/cjs/components/Icons/'),
    )
    .forEach((path, i) => {
      const importDeclaration = path.value;
      const localName = importDeclaration.specifiers[0].local.name;
      const actualName = path.value.source.value.replace('@pitchero/react-ui/dist/cjs/components/Icons/', '');
      actualNamesByLocalName[localName] = actualName;
      if (i === 0) {
        importDeclaration.specifiers = [j.importDefaultSpecifier(j.identifier('Icon'))];
        importDeclaration.source = j.stringLiteral(relative(fileDirPath, iconModulePath));
      } else {
        j(path).remove();
      }
    })
    .toSource({ quote: 'single' });

  const withUpdatedIconComponents = j(withUpdatedIconImports)
    .find(j.JSXOpeningElement)
    .filter(
      (path) => path.value && path.value.name && path.value.name.name && path.value.name.name in actualNamesByLocalName,
    )
    .forEach((path) => {
      const jSXOpeningElement = path.value;
      const localName = jSXOpeningElement.name.name;
      const actualName = actualNamesByLocalName[localName];
      const kebabName =
        actualName.slice(0, 1).toLowerCase() +
        actualName
          .slice(1)
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase();
      jSXOpeningElement.name = j.jsxIdentifier('Icon');
      jSXOpeningElement.attributes.unshift(j.jsxAttribute(j.jsxIdentifier('name'), j.stringLiteral(kebabName)));
    })
    .toSource({ quote: 'single' });

  return withUpdatedIconComponents;
};
