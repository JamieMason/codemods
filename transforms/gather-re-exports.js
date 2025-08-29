const nodePath = require('path');
const fs = require('fs');

// Module-scope object to track visited files and their re-exported symbols
// Keys: absolute file paths of visited files
// Values: object with re-exported symbol names as keys and their source file paths as values
const visitedFiles = {};

export default (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // where to write the manifest
  const pathToManifest = options.manifest;
  const absolutePathToManifest = nodePath.resolve(pathToManifest);

  // Get the absolute path of the current file being transformed
  const currentFileAbsolute = nodePath.resolve(file.path);
  const currentDir = nodePath.dirname(currentFileAbsolute);

  // Transform to Node.js module resolution format (same as symbolToFileMap keys)
  // Remove file extension and handle index files specially
  const currentFilePath = (() => {
    const parsed = nodePath.parse(currentFileAbsolute);
    const withoutExtension = nodePath.join(parsed.dir, parsed.name);

    // If the file is named "index", Node.js resolution points to the directory
    if (parsed.name === 'index') {
      return parsed.dir;
    }

    return withoutExtension;
  })();

  // Record to map imported symbol names to their absolute file paths
  const symbolToFileMap = {};

  // Find all import declarations with relative paths (starting with '.')
  const relativeImports = root.find(j.ImportDeclaration).filter((path) => {
    const source = path.node.source;
    return source && source.value && typeof source.value === 'string' && source.value.startsWith('.');
  });

  // Process each relative import to extract symbols and resolve absolute paths
  relativeImports.forEach((importPath) => {
    const importNode = importPath.node;
    const relativePath = importNode.source.value;

    // Resolve the relative path to an absolute path
    const absolutePath = nodePath.resolve(currentDir, relativePath);

    // Extract all imported symbols from this import
    importNode.specifiers.forEach((specifier) => {
      if (j.ImportDefaultSpecifier.check(specifier)) {
        // Default import: import Foo from './path'
        const symbolName = specifier.local.name;
        symbolToFileMap[symbolName] = {
          filePath: absolutePath,
          originalName: symbolName, // For default imports, original and local are the same
          localName: symbolName,
        };
      } else if (j.ImportSpecifier.check(specifier)) {
        // Named import: import { Foo } from './path' or import { Foo as Bar } from './path'
        const localName = specifier.local.name;
        const originalName = specifier.imported.name;
        symbolToFileMap[localName] = {
          filePath: absolutePath,
          originalName: originalName,
          localName: localName,
        };
      } else if (j.ImportNamespaceSpecifier.check(specifier)) {
        // Namespace import: import * as Foo from './path'
        const symbolName = specifier.local.name;
        symbolToFileMap[symbolName] = {
          filePath: absolutePath,
          originalName: symbolName, // For namespace imports, original and local are the same
          localName: symbolName,
        };
      }
    });
  });

  // Find all exported symbol names and store in a Set
  const exportedSymbols = new Set();

  // Find all named exports
  const allNamedExports = root.find(j.ExportNamedDeclaration);
  allNamedExports.forEach((exportPath) => {
    const exportNode = exportPath.node;

    // Handle export specifiers (export { foo, bar })
    if (exportNode.specifiers && exportNode.specifiers.length > 0) {
      exportNode.specifiers.forEach((specifier) => {
        if (j.ExportSpecifier.check(specifier)) {
          // Get the exported name (could be aliased: export { foo as bar })
          const exportedName = specifier.exported.name;
          exportedSymbols.add(exportedName);
        }
      });
    }

    // Handle declaration exports (export const foo = ...)
    if (exportNode.declaration) {
      if (j.VariableDeclaration.check(exportNode.declaration)) {
        exportNode.declaration.declarations.forEach((declarator) => {
          if (j.Identifier.check(declarator.id)) {
            exportedSymbols.add(declarator.id.name);
          }
        });
      } else if (
        j.FunctionDeclaration.check(exportNode.declaration) ||
        j.ClassDeclaration.check(exportNode.declaration)
      ) {
        if (exportNode.declaration.id && j.Identifier.check(exportNode.declaration.id)) {
          exportedSymbols.add(exportNode.declaration.id.name);
        }
      }
    }
  });

  // Find all default exports
  const allDefaultExports = root.find(j.ExportDefaultDeclaration);
  allDefaultExports.forEach((exportPath) => {
    const exportNode = exportPath.node;

    // For default exports that are identifiers, add the identifier name
    if (j.Identifier.check(exportNode.declaration)) {
      exportedSymbols.add(exportNode.declaration.name);
    }
    // Note: We don't handle anonymous default exports (export default function() {})
    // as they don't have symbol names that would match imports
  });

  // Create filtered set containing only exported symbols that were imported from another file
  const reExportedSymbols = new Set(
    [...exportedSymbols].filter((symbolName) => symbolToFileMap.hasOwnProperty(symbolName)),
  );

  // Handle direct re-exports (export { ... } from '...', export * from '...', etc.)
  const directReExports = root.find(j.ExportNamedDeclaration).filter((path) => {
    return (
      path.node.source &&
      path.node.source.value &&
      typeof path.node.source.value === 'string' &&
      path.node.source.value.startsWith('.')
    );
  });

  directReExports.forEach((exportPath) => {
    const exportNode = exportPath.node;
    const relativePath = exportNode.source.value;
    const absolutePath = nodePath.resolve(currentDir, relativePath);

    // Handle specifiers in direct re-exports
    if (exportNode.specifiers && exportNode.specifiers.length > 0) {
      exportNode.specifiers.forEach((specifier) => {
        if (j.ExportSpecifier.check(specifier)) {
          const exportedName = specifier.exported.name;
          const importedName = specifier.local.name;

          symbolToFileMap[exportedName] = {
            filePath: absolutePath,
            originalName: importedName,
            localName: exportedName,
          };
          reExportedSymbols.add(exportedName);
        }
      });
    } else {
      // Handle export * from '...' - this is a namespace re-export
      // We'll treat this as a special case
      symbolToFileMap['*'] = {
        filePath: absolutePath,
        originalName: '*',
        localName: '*',
      };
      reExportedSymbols.add('*');
    }
  });

  // Also handle export * declarations separately
  const exportAllDeclarations = root.find(j.ExportAllDeclaration).filter((path) => {
    return (
      path.node.source &&
      path.node.source.value &&
      typeof path.node.source.value === 'string' &&
      path.node.source.value.startsWith('.')
    );
  });

  exportAllDeclarations.forEach((exportPath) => {
    const exportNode = exportPath.node;
    const relativePath = exportNode.source.value;
    const absolutePath = nodePath.resolve(currentDir, relativePath);

    // Handle export * from '...' - this is a namespace re-export
    symbolToFileMap['*'] = {
      filePath: absolutePath,
      originalName: '*',
      localName: '*',
    };
    reExportedSymbols.add('*');
  });

  // Track this file and its re-exported symbols in the module-scope object
  const reExportedSymbolsMap = {};
  [...reExportedSymbols].forEach((symbolName) => {
    const symbolInfo = symbolToFileMap[symbolName];

    // Handle the case where symbolInfo might be a path string (old format) or object (new format)
    if (typeof symbolInfo === 'string') {
      reExportedSymbolsMap[symbolName] = {
        filePath: symbolInfo,
        originalName: symbolName,
        localName: symbolName,
        exportType: 'named',
      };
    } else {
      reExportedSymbolsMap[symbolName] = {
        filePath: symbolInfo.filePath,
        originalName: symbolInfo.originalName,
        localName: symbolInfo.localName,
        exportType: symbolName === '*' ? 'namespace' : 'named', // Special handling for export *
      };
    }
  });

  // Determine the actual export type for each symbol by analyzing how they were imported/re-exported
  [...reExportedSymbols].forEach((symbolName) => {
    const symbolInfo = symbolToFileMap[symbolName];

    // Skip type determination for namespace exports (export *)
    if (symbolName === '*') {
      return;
    }

    const originalFilePath = typeof symbolInfo === 'string' ? symbolInfo : symbolInfo.filePath;

    // First check direct re-exports (export { ... } from '...')
    let foundDirectReExport = false;
    directReExports.forEach((exportPath) => {
      const exportNode = exportPath.node;
      const relativePath = exportNode.source.value;
      const resolvedPath = nodePath.resolve(currentDir, relativePath);

      if (resolvedPath === originalFilePath && exportNode.specifiers) {
        exportNode.specifiers.forEach((specifier) => {
          if (j.ExportSpecifier.check(specifier) && specifier.exported.name === symbolName) {
            // Check if we're re-exporting a default (export { default } from '...' or export { default as Name } from '...')
            if (specifier.local.name === 'default') {
              reExportedSymbolsMap[symbolName].exportType = 'default';
              foundDirectReExport = true;
            }
            // Otherwise it remains 'named'
          }
        });
      }
    });

    // If not found in direct re-exports, check import declarations
    if (!foundDirectReExport) {
      relativeImports.forEach((importPath) => {
        const importNode = importPath.node;
        const relativePath = importNode.source.value;
        const resolvedPath = nodePath.resolve(currentDir, relativePath);

        if (resolvedPath === originalFilePath) {
          // Check how this symbol was imported to determine its export type
          importNode.specifiers.forEach((specifier) => {
            if (j.ImportDefaultSpecifier.check(specifier) && specifier.local.name === symbolName) {
              reExportedSymbolsMap[symbolName].exportType = 'default';
            } else if (j.ImportNamespaceSpecifier.check(specifier) && specifier.local.name === symbolName) {
              reExportedSymbolsMap[symbolName].exportType = 'namespace';
            }
            // Named imports remain as 'named'
          });
        }
      });
    }
  });

  // Only set property in visitedFiles if there are exported symbols
  if (Object.keys(reExportedSymbolsMap).length > 0) {
    visitedFiles[currentFilePath] = reExportedSymbolsMap;
  }

  // Write visitedFiles to JSON file
  fs.writeFileSync(absolutePathToManifest, JSON.stringify(visitedFiles, null, 2));
};
