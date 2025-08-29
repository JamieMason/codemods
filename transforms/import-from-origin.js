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
  const currentDir = nodePath.dirname(currentFileAbsolute);

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
    let absolutePath = nodePath.resolve(currentDir, relativePath);

    // Transform to Node.js module resolution format (same as manifest keys)
    // Remove file extension and handle index files specially
    const transformedPath = (() => {
      const parsed = nodePath.parse(absolutePath);
      const withoutExtension = nodePath.join(parsed.dir, parsed.name);

      // If the file is named "index", Node.js resolution points to the directory
      if (parsed.name === 'index') {
        return parsed.dir;
      }

      return withoutExtension;
    })();

    // Extract all imported symbols from this import
    importNode.specifiers.forEach((specifier) => {
      if (j.ImportDefaultSpecifier.check(specifier)) {
        // Default import: import Foo from './path'
        const symbolName = specifier.local.name;
        symbolToFileMap[symbolName] = {
          filePath: transformedPath,
          importedName: 'default', // For default imports, we always look for 'default' in the manifest
          localName: symbolName,
        };
      } else if (j.ImportSpecifier.check(specifier)) {
        // Named import: import { Foo } from './path' or import { Foo as Bar } from './path'
        const localName = specifier.local.name;
        const importedName = specifier.imported.name; // This is the key for manifest lookup
        symbolToFileMap[localName] = {
          filePath: transformedPath,
          importedName: importedName,
          localName: localName,
        };
      } else if (j.ImportNamespaceSpecifier.check(specifier)) {
        // Namespace import: import * as Foo from './path'
        const symbolName = specifier.local.name;
        symbolToFileMap[symbolName] = {
          filePath: transformedPath,
          importedName: '*', // For namespace imports, we look for '*' in the manifest
          localName: symbolName,
        };
      }
    });
  });

  // Collect all barrel file imports that need to be transformed
  const barrelImports = [];

  Object.entries(symbolToFileMap).forEach(([localSymbolName, symbolDetails]) => {
    const { filePath: importedFromPath, importedName, localName } = symbolDetails;
    // Check if the file it was imported from is in our manifest (is a barrel file)
    if (manifest.hasOwnProperty(importedFromPath)) {
      const barrelFileReExports = manifest[importedFromPath];

      // Check if the symbol is one of the re-exported symbols in this barrel file
      // Use the importedName for manifest lookup, not the localName
      if (barrelFileReExports.hasOwnProperty(importedName)) {
        const symbolInfo = barrelFileReExports[importedName];

        // Handle backward compatibility with old manifest format
        let originalSourcePath, exportType, manifestOriginalName, manifestLocalName;
        if (typeof symbolInfo === 'string') {
          // Old format: just file path
          originalSourcePath = symbolInfo;
          exportType = 'named';
          manifestOriginalName = importedName;
          manifestLocalName = importedName;
        } else {
          // New format: object with detailed info
          originalSourcePath = symbolInfo.filePath;
          exportType = symbolInfo.exportType || 'named';
          manifestOriginalName = symbolInfo.originalName || importedName;
          manifestLocalName = symbolInfo.localName || importedName;
        }

        // Recursively resolve through nested barrel files
        let finalPath = originalSourcePath;
        let finalExportType = exportType;
        let finalOriginalName = manifestOriginalName;
        let finalLocalName = localName; // Use the local name from the actual import
        let visitedPaths = new Set([importedFromPath]); // Prevent infinite loops

        while (manifest.hasOwnProperty(finalPath) && !visitedPaths.has(finalPath)) {
          visitedPaths.add(finalPath);
          const nestedBarrelInfo = manifest[finalPath];

          if (nestedBarrelInfo.hasOwnProperty(finalOriginalName)) {
            const nestedSymbolInfo = nestedBarrelInfo[finalOriginalName];

            // Handle format
            if (typeof nestedSymbolInfo === 'string') {
              finalPath = nestedSymbolInfo;
              // Keep existing export type and names for simple format
            } else {
              finalPath = nestedSymbolInfo.filePath;
              finalExportType = nestedSymbolInfo.exportType || finalExportType;
              finalOriginalName = nestedSymbolInfo.originalName || finalOriginalName;
              // Keep the local name from the first resolution
            }
          } else {
            // Symbol not found in this barrel, stop recursion
            break;
          }
        }

        barrelImports.push({
          symbolName: localSymbolName,
          barrelPath: importedFromPath,
          originalPath: finalPath,
          exportType: finalExportType,
          originalName: finalOriginalName,
          localName: finalLocalName,
        });
      }
    }
  });

  // Transform the imports if we found any barrel file imports
  if (barrelImports.length > 0) {
    console.log(`Transforming ${barrelImports.length} barrel file imports in ${currentFileAbsolute}`);

    // Group barrel imports by their original source path to avoid duplicate imports
    const importsByOriginalPath = {};
    barrelImports.forEach(({ symbolName, originalPath, exportType, originalName, localName }) => {
      if (!importsByOriginalPath[originalPath]) {
        importsByOriginalPath[originalPath] = {
          namedImports: [],
          defaultImports: [],
          namespaceImports: [],
        };
      }

      if (exportType === 'default') {
        importsByOriginalPath[originalPath].defaultImports.push({
          localName: symbolName,
          originalName: originalName,
        });
      } else if (exportType === 'namespace') {
        importsByOriginalPath[originalPath].namespaceImports.push({
          localName: symbolName,
          originalName: originalName,
        });
      } else {
        importsByOriginalPath[originalPath].namedImports.push({
          localName: symbolName,
          originalName: originalName,
        });
      }
    });

    // Add new import declarations for symbols from their original files
    Object.entries(importsByOriginalPath).forEach(
      ([originalPath, { namedImports, defaultImports, namespaceImports }]) => {
        // Convert the manifest path (Node.js module resolution format) back to a valid import path
        // originalPath is in format like "/abs/path/to/file" but we need "/abs/path/to/file.ts" or "/abs/path/to/file/index.ts"

        let actualFilePath = originalPath;

        // Try to find the actual file by checking common extensions and index files
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];
        let fileExists = false;

        // First try adding extensions to the base path
        for (const ext of extensions) {
          const pathWithExt = originalPath + ext;
          if (fs.existsSync(pathWithExt)) {
            actualFilePath = pathWithExt;
            fileExists = true;
            break;
          }
        }

        // If not found, try index files in the directory
        if (!fileExists) {
          for (const ext of extensions) {
            const indexPath = nodePath.join(originalPath, 'index' + ext);
            if (fs.existsSync(indexPath)) {
              actualFilePath = indexPath;
              fileExists = true;
              break;
            }
          }
        }

        if (!fileExists) {
          console.warn(`Warning: Could not find actual file for manifest path: ${originalPath}`);
          // Fallback to original path
          actualFilePath = originalPath;
        }

        // Convert absolute path back to relative path for the import
        const relativePath = nodePath.relative(currentDir, actualFilePath);
        let relativeImportPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;

        // Remove file extension for import (TypeScript/JS imports don't need extensions)
        const parsed = nodePath.parse(relativeImportPath);
        if (extensions.includes(parsed.ext)) {
          // For index files, point to the directory
          if (parsed.name === 'index') {
            relativeImportPath = parsed.dir || '.';
          } else {
            relativeImportPath = nodePath.join(parsed.dir, parsed.name);
          }
        }

        // Ensure the path starts with ./ or ../
        if (!relativeImportPath.startsWith('.')) {
          relativeImportPath = './' + relativeImportPath;
        }

        // Create import specifiers
        const importSpecifiers = [];

        // Add default imports
        defaultImports.forEach(({ localName, originalName }) => {
          importSpecifiers.push(j.importDefaultSpecifier(j.identifier(localName)));
        });

        // Add namespace imports
        namespaceImports.forEach(({ localName, originalName }) => {
          importSpecifiers.push(j.importNamespaceSpecifier(j.identifier(localName)));
        });

        // Add named imports
        namedImports.forEach(({ localName, originalName }) => {
          if (localName === originalName) {
            // No alias needed: import { Foo } from './path'
            importSpecifiers.push(j.importSpecifier(j.identifier(originalName)));
          } else {
            // Alias needed: import { Foo as Bar } from './path'
            importSpecifiers.push(j.importSpecifier(j.identifier(originalName), j.identifier(localName)));
          }
        });

        if (importSpecifiers.length > 0) {
          const newImportDeclaration = j.importDeclaration(importSpecifiers, j.literal(relativeImportPath));

          // Add the new import at the top of the file
          const imports = root.find(j.ImportDeclaration);
          if (imports.length > 0) {
            imports.at(0).insertBefore(newImportDeclaration);
          } else {
            // If no imports exist, add at the beginning of the program
            root.get().node.body.unshift(newImportDeclaration);
          }
        }
      },
    );

    // Remove symbols from barrel file imports
    const barrelSymbolsToRemove = {};
    barrelImports.forEach(({ symbolName, barrelPath }) => {
      if (!barrelSymbolsToRemove[barrelPath]) {
        barrelSymbolsToRemove[barrelPath] = new Set();
      }
      barrelSymbolsToRemove[barrelPath].add(symbolName);
    });

    // Process each barrel file import to remove symbols or entire declarations
    Object.entries(barrelSymbolsToRemove).forEach(([barrelPath, symbolsToRemove]) => {
      // Find the import declaration for this barrel file
      const barrelImports = root.find(j.ImportDeclaration).filter((path) => {
        const source = path.node.source;
        if (!source || !source.value) return false;

        // Resolve the import path to absolute for comparison
        const resolvedPath = nodePath.resolve(currentDir, source.value);
        const transformedPath = (() => {
          const parsed = nodePath.parse(resolvedPath);
          const withoutExtension = nodePath.join(parsed.dir, parsed.name);
          if (parsed.name === 'index') {
            return parsed.dir;
          }
          return withoutExtension;
        })();

        return transformedPath === barrelPath;
      });

      barrelImports.forEach((importPath) => {
        const importNode = importPath.node;

        // Filter out the symbols we want to remove
        const remainingSpecifiers = importNode.specifiers.filter((specifier) => {
          if (j.ImportSpecifier.check(specifier)) {
            return !symbolsToRemove.has(specifier.local.name);
          } else if (j.ImportDefaultSpecifier.check(specifier)) {
            return !symbolsToRemove.has(specifier.local.name);
          } else if (j.ImportNamespaceSpecifier.check(specifier)) {
            return !symbolsToRemove.has(specifier.local.name);
          }
          return true;
        });

        if (remainingSpecifiers.length === 0) {
          // Remove the entire import declaration if no symbols remain
          j(importPath).remove();
        } else {
          // Update the import declaration with remaining symbols
          importNode.specifiers = remainingSpecifiers;
        }
      });
    });
  }

  // Return the transformed source
  return root.toSource();
};
