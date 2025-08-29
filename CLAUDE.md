# Project Context for AI Assistants

## Project Overview

This is a collection of **codemods** (code transformation tools) built using [JSCodeshift](https://github.com/facebook/jscodeshift). Codemods are automated scripts that parse, analyze, and transform JavaScript/TypeScript code at scale.

**Key Details:**
- **Author:** Jamie Mason (@JamieMason)
- **Purpose:** Automate common code refactoring patterns
- **Technology:** JSCodeshift (Facebook's toolkit for JavaScript codemods)
- **License:** MIT
- **Version:** 0.16.3

## Architecture & Structure

```
/transforms/           # Core transformation scripts
  ├── lib/            # Shared utilities and helpers
  │   ├── file.js     # File system utilities
  │   └── helpers.js  # Common transformation helpers
  └── *.js            # Individual transformation modules

/test/                # Test infrastructure
  ├── fixtures/       # Input/output test cases
  │   └── */          # One directory per transform
  └── codemods.spec.js # Test runner

package.json          # NPM scripts for each transform
```

## Available Transformations

### React-Specific Transforms
1. **add-react-import** - Auto-imports React when JSX is detected
2. **remove-react-prop-types** - Removes PropTypes usage (React 18+ migration)
3. **remove-react-default-props** - Removes defaultProps usage (React 18+ migration)
4. **move-children-prop** - Converts `children` prop to JSX children syntax
5. **sort-jsx-props** - Alphabetically sorts JSX component props

### Import/Export Transforms
6. **import-from-root** - Converts deep imports to root package imports
7. **use-named-exports** - Converts default exports to named exports
8. **use-named-imports** - Converts default imports to named imports
9. **remove-barrel-file** - Removes barrel file imports and replaces with direct imports

### Code Style Transforms
10. **use-string-literal-props** - Converts JSX string expressions to string literals
11. **sort-object-props** - Alphabetically sorts object literal properties

## Usage Patterns

### Command Line Usage
```bash
# Using npm scripts (recommended)
npm run transform-name -- <file-path>

# Direct jscodeshift usage
jscodeshift -t ./transforms/transform-name.js <file-path>

# With additional options
jscodeshift -t ./transforms/transform-name.js --parser tsx --extensions js,jsx,ts,tsx <file-path>
```

### Environment Variables
- `IMPORT_FROM_ROOT` - Used by import-from-root transform to target specific packages

## Development Workflow

### Creating New Transforms
1. Create transform file: `./transforms/new-transform.js`
2. Add test fixtures: `./test/fixtures/new-transform/`
   - `scenario.input.js` - Input code
   - `scenario.output.js` - Expected output
3. Add npm script to `package.json`
4. Test with `npm test`

### Transform Structure
```javascript
export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Transformation logic here
  // Use j.find(), j.replaceWith(), etc.

  return root.toSource();
};
```

## Key Dependencies

- **jscodeshift (17.1.1)** - Core transformation engine
- **jest (27.4.5)** - Testing framework
- **babel-preset-env** - JavaScript transpilation for tests

## Testing Strategy

- **Fixture-based testing** - Each transform has input/output file pairs
- **Automated discovery** - Test runner automatically finds and tests all fixtures
- **Snapshot testing** - Ensures transforms produce expected output

## Common Use Cases

1. **Large-scale refactoring** - Apply consistent changes across many files
2. **Framework migrations** - React version upgrades, API changes
3. **Code style enforcement** - Consistent import patterns, prop ordering
4. **Legacy code modernization** - Convert old patterns to modern equivalents

## Important Notes

⚠️ **Limitations:**
- Some transforms are "naive" and may require manual cleanup
- Always run with version control and review changes
- Test thoroughly before applying to production code
- Some transforms may create naming conflicts that need manual resolution

🔧 **Best Practices:**
- Run transforms on isolated branches
- Use ESLint after transforms to catch issues
- Review all changes before committing
- Test incrementally on smaller codebases first

## JSCodeshift Documentation & Reference

This project is built on [JSCodeshift](https://jscodeshift.com/), Facebook's toolkit for JavaScript codemods. Understanding the core APIs is essential for working with this codebase.

### Core JSCodeshift Concepts

**Two-Phase Transformation Process:**
1. **Detection Phase** - Finding and filtering AST nodes
   - Initial scope reduction (broad search)
   - Detailed node filtering (specific targeting)
2. **Transformation Phase** - Modifying the AST and generating new code

### Essential API Categories

Based on the [official API reference](https://jscodeshift.com/build/api-reference/):

**Core API:**
- `jscodeshift(source)` - Main function that returns the jscodeshift instance

**Node Traversal APIs (Detection):**
- `find(type)` - Finds nodes matching provided type
- `findImportDeclarations(sourcePath)` - Finds import declarations by module name
- `filter(predicate)` - Filters nodes based on predicate function
- `forEach(callback)` - Iterates over each node in collection
- `some(callback)` / `every(callback)` - Tests collection elements
- `closestScope()` / `closest(type)` - Finds nearest parent scope/node
- `getVariableDeclarators(callback)` - Retrieves variable declarators

**Node Transformation APIs:**
- `replaceWith(newNode)` - Replaces current node(s) with new node
- `insertBefore(newNode)` / `insertAfter(newNode)` - Inserts nodes
- `remove()` - Removes current node(s)
- `renameTo(newName)` - Renames nodes to new name
- `toSource(options)` - Converts transformed AST back to source code

### AST Grammar Reference

The [AST Grammar documentation](https://jscodeshift.com/build/ast-grammar/) provides complete type definitions for all AST nodes. Key interfaces include:

- **Expressions**: `CallExpression`, `ArrowFunctionExpression`, `BinaryExpression`
- **Statements**: `VariableDeclaration`, `FunctionDeclaration`, `ExpressionStatement`
- **Imports/Exports**: `ImportDeclaration`, `ExportDeclaration`, `ImportSpecifier`
- **JSX**: `JSXElement`, `JSXAttribute`, `JSXExpressionContainer`
- **TypeScript**: Type annotations and interfaces

### CLI Usage

The [CLI documentation](https://jscodeshift.com/run/cli/) covers command-line options:

```bash
jscodeshift -t transform.js [path...]
  --parser tsx              # Parser: babel, babylon, flow, ts, tsx
  --extensions js,jsx,ts,tsx # File extensions to process
  --ignore-pattern pattern  # Ignore file patterns
  --dry                     # Dry run (no file writes)
  --print                   # Print transformed files
```

### Development Resources

- **Official Documentation** - [jscodeshift.com](https://jscodeshift.com/overview/introduction/)
- **API Reference** - [jscodeshift.com/build/api-reference/](https://jscodeshift.com/build/api-reference/)
- **AST Grammar** - [jscodeshift.com/build/ast-grammar/](https://jscodeshift.com/build/ast-grammar/)
- **CLI Reference** - [jscodeshift.com/run/cli/](https://jscodeshift.com/run/cli/)
- **AST Explorer** - [astexplorer.net](https://astexplorer.net) for interactive AST exploration
- **ast-types** - AST node type definitions (used by jscodeshift internally)

### Transform Development Pattern

```javascript
export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // 1. Detection: Find target nodes
  const targetNodes = root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value.startsWith('./'));

  // 2. Transformation: Modify AST
  targetNodes.forEach(path => {
    // Transform logic here
    j(path).replaceWith(newNode);
  });

  // 3. Output: Generate transformed code
  return root.toSource({
    quote: 'single',
    reuseParsers: true
  });
};
```

This project demonstrates advanced AST manipulation and provides reusable patterns for JavaScript/TypeScript code transformation using the comprehensive JSCodeshift API.
