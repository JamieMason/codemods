export const registerMethods = j => {
  const isTopLevel = path => path.parent.value.type === 'Program';
  j.registerMethods({
    getDefaultExportByVarName(varName) {
      return this.find(j.ExportDefaultDeclaration, {
        declaration: { type: 'Identifier', name: varName }
      });
    },
    getExportsByVarName(varName) {
      return this.find(j.ExportNamedDeclaration, {
        declaration: {
          type: 'VariableDeclaration',
          declarations: [{ type: 'VariableDeclarator', id: { type: 'Identifier', name: varName } }]
        }
      });
    },
    getExportsByClassName(className) {
      return this.find(j.ExportNamedDeclaration, {
        declaration: { type: 'ClassDeclaration', id: { type: 'Identifier', name: className } }
      });
    },
    getImportsByPackageName(packageName) {
      return this.find(j.ImportDeclaration, {
        source: {
          value: packageName
        }
      });
    },
    getNamedExportedVars() {
      return this.find(j.ExportNamedDeclaration, {
        declaration: { type: 'VariableDeclaration' }
      });
    },
    getNamedExportedClasses() {
      return this.find(j.ExportNamedDeclaration, {
        declaration: { type: 'ClassDeclaration', id: { type: 'Identifier' } }
      });
    },
    getTopLevelClasses() {
      return this.find(j.ClassDeclaration).filter(isTopLevel);
    },
    getTopLevelFunctions() {
      return this.find(j.FunctionDeclaration).filter(isTopLevel);
    },
    getTopLevelVariables() {
      return this.find(j.VariableDeclaration).filter(isTopLevel);
    },
    getTopLevelClassByName(className) {
      return this.find(j.ClassDeclaration, {
        id: { type: 'Identifier', name: className }
      }).filter(isTopLevel);
    },
    getTopLevelFunctionByName(className) {
      return this.find(j.FunctionDeclaration, {
        id: { type: 'Identifier', name: className }
      }).filter(isTopLevel);
    },
    getTopLevelVariableByName(varName) {
      return this.find(j.VariableDeclaration, {
        declarations: [{ type: 'VariableDeclarator', id: { type: 'Identifier', name: varName } }]
      }).filter(isTopLevel);
    },
    getTopLevelVarNames() {
      const identifiers = [];
      this.find(j.ImportDeclaration).forEach(path => {
        const importDeclaration = path.value;
        importDeclaration.specifiers.forEach(specifier => {
          identifiers.push(specifier.local.name);
        });
      });
      this.getNamedExportedVars().forEach(path => {
        const exportNamedDeclaration = path.value;
        exportNamedDeclaration.declaration.declarations.forEach(declaration => {
          identifiers.push(declaration.id.name);
        });
      });
      this.getNamedExportedClasses().forEach(path => {
        const exportNamedDeclaration = path.value;
        identifiers.push(exportNamedDeclaration.declaration.id.name);
      });
      this.getTopLevelClasses().forEach(path => {
        const classDeclaration = path.value;
        identifiers.push(classDeclaration.id.name);
      });
      this.getTopLevelFunctions().forEach(path => {
        const functionDeclaration = path.value;
        identifiers.push(functionDeclaration.id.name);
      });
      this.getTopLevelVariables().forEach(path => {
        const variableDeclaration = path.value;
        variableDeclaration.declarations.forEach(declaration => {
          identifiers.push(declaration.id.name);
        });
      });
      return identifiers;
    },
    exportClass(path) {
      const classDeclaration = path.value;
      return j.exportNamedDeclaration(
        j.classDeclaration(
          j.identifier(classDeclaration.id.name),
          classDeclaration.body,
          classDeclaration.superClass
        )
      );
    },
    exportFunction(path) {
      const functionDeclaration = path.value;
      return j.exportNamedDeclaration(
        j.functionDeclaration(
          j.identifier(functionDeclaration.id.name),
          functionDeclaration.params,
          functionDeclaration.body
        )
      );
    },
    exportVariable(path) {
      const variableDeclaration = path.value;
      return j.exportNamedDeclaration(
        j.variableDeclaration('const', variableDeclaration.declarations)
      );
    }
  });
};
