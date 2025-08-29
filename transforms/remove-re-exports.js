const nodePath = require('path');
const fs = require('fs');

let manifest = null;

export default (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const pathToManifest = options.manifest;

  if (!manifest) {
    const absolutePathToManifest = nodePath.resolve(pathToManifest);
    manifest = JSON.parse(fs.readFileSync(absolutePathToManifest, 'utf8'));
  }

  // Get the absolute path of the current file being transformed
  const currentFileAbsolute = nodePath.resolve(file.path);

  // Transform to Node.js module resolution format (same as manifest keys)
  const currentFilePath = (() => {
    const parsed = nodePath.parse(currentFileAbsolute);
    const withoutExtension = nodePath.join(parsed.dir, parsed.name);

    // If the file is named "index", Node.js resolution points to the directory
    if (parsed.name === 'index') {
      return parsed.dir;
    }

    return withoutExtension;
  })();

  // Check if this file is in our manifest (is a barrel file with re-exports)
  if (!manifest.hasOwnProperty(currentFilePath)) {
    // This file is not a barrel file, no changes needed
    return root.toSource();
  }

  const reExportedSymbols = manifest[currentFilePath];
  const symbolsToRemove = Object.keys(reExportedSymbols);

  if (symbolsToRemove.length === 0) {
    // No re-exported symbols to remove
    return root.toSource();
  }

  console.log(`Removing ${symbolsToRemove.length} re-exported symbols from ${currentFileAbsolute}`);

  // Track which imported symbols are used for re-export
  const importedSymbolsUsedForReExport = new Set();

  // Find and remove export declarations that re-export these symbols
  root.find(j.ExportNamedDeclaration).forEach((exportPath) => {
    const exportNode = exportPath.node;

    // Handle export specifiers (export { foo, bar })
    if (exportNode.specifiers && exportNode.specifiers.length > 0) {
      const remainingSpecifiers = exportNode.specifiers.filter((specifier) => {
        if (j.ExportSpecifier.check(specifier)) {
          const exportedName = specifier.exported.name;
          const localName = specifier.local.name;

          if (symbolsToRemove.includes(exportedName)) {
            // Track the local name (what was imported) for potential removal
            importedSymbolsUsedForReExport.add(localName);
            return false; // Remove this specifier
          }
        }
        return true; // Keep this specifier
      });

      if (remainingSpecifiers.length === 0) {
        // Remove the entire export declaration if no specifiers remain
        j(exportPath).remove();
      } else {
        // Update the export declaration with remaining specifiers
        exportNode.specifiers = remainingSpecifiers;
      }
    }

    // Handle direct export from source (export { foo } from './path')
    if (exportNode.source) {
      const remainingSpecifiers = exportNode.specifiers.filter((specifier) => {
        if (j.ExportSpecifier.check(specifier)) {
          const exportedName = specifier.exported.name;
          return !symbolsToRemove.includes(exportedName);
        }
        return true;
      });

      if (remainingSpecifiers.length === 0) {
        // Remove the entire export declaration if no specifiers remain
        j(exportPath).remove();
      } else {
        // Update the export declaration with remaining specifiers
        exportNode.specifiers = remainingSpecifiers;
      }
    }
  });

  // Remove default exports if they are re-exported symbols
  root.find(j.ExportDefaultDeclaration).forEach((exportPath) => {
    const exportNode = exportPath.node;

    if (j.Identifier.check(exportNode.declaration)) {
      const exportedName = exportNode.declaration.name;
      if (symbolsToRemove.includes(exportedName)) {
        importedSymbolsUsedForReExport.add(exportedName);
        j(exportPath).remove();
      }
    }
  });

  // Find and remove import declarations for symbols that are only used for re-export
  const allUsedSymbols = new Set();

  // Find all symbols used in the file (excluding exports)
  root.find(j.Identifier).forEach((path) => {
    // Skip export declarations since we're removing those
    if (path.parent.value.type !== 'ExportSpecifier' && path.parent.value.type !== 'ExportDefaultDeclaration') {
      allUsedSymbols.add(path.value.name);
    }
  });

  // Remove imports that are only used for re-export
  root.find(j.ImportDeclaration).forEach((importPath) => {
    const importNode = importPath.node;

    const remainingSpecifiers = importNode.specifiers.filter((specifier) => {
      let symbolName;

      if (j.ImportDefaultSpecifier.check(specifier)) {
        symbolName = specifier.local.name;
      } else if (j.ImportSpecifier.check(specifier)) {
        symbolName = specifier.local.name;
      } else if (j.ImportNamespaceSpecifier.check(specifier)) {
        symbolName = specifier.local.name;
      }

      // Keep the import if:
      // 1. It's not used for re-export, OR
      // 2. It's used elsewhere in the file
      return !importedSymbolsUsedForReExport.has(symbolName) || allUsedSymbols.has(symbolName);
    });

    if (remainingSpecifiers.length === 0) {
      // Remove the entire import declaration if no specifiers remain
      j(importPath).remove();
    } else {
      // Update the import declaration with remaining specifiers
      importNode.specifiers = remainingSpecifiers;
    }
  });

  return root.toSource();
};
