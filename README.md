# codemods

A collection of transforms for use with
[facebook/jscodeshift](https://github.com/facebook/jscodeshift).

## Installation

```sh
git clone https://github.com/JamieMason/codemods.git
cd codemods
yarn install
```

## Usage

```
# yarn
yarn name-of-the-transform <path-to-file>

# npm
npm run name-of-the-transform -- <path-to-file>

# jscodeshift
jscodeshift -t ./transforms/name-of-the-transform.js <path-to-file>
```

## Transforms

### import-from-root

Rewrite deep imports to import from a packages' root index.

> Set the Environment Variable `IMPORT_FROM_ROOT` to apply this transform only to packages whose
> name starts with that string: `IMPORT_FROM_ROOT=some-package yarn import-from-root <path-to-file>`

```js
/* INPUT */
import { foo } from 'some-package/foo/bar/baz';

/* OUTPUT */
import { foo } from 'some-package';
```

### sort-jsx-props

Sort props of JSX Components alphabetically.

```jsx
/* INPUT */
<Music zootWoman={true} rickJames={true} zapp={true} />

/* OUTPUT */
<Music rickJames={true} zapp={true} zootWoman={true} />
```

### sort-object-props

Sort members of Object Literals alphabetically.

```js
/* INPUT */
const players = { messi: true, bergkamp: true, ginola: true };

/* OUTPUT */
const players = { bergkamp: true, ginola: true, messi: true };
```

### use-named-exports

Naively convert a default export to a named export using the name of the file, which may clash with
other variable names in the file. This codemod would need following up on with ESLint and some
manual fixes.

```js
/* INPUT */
// ~/Dev/repo/src/apps/health/server.js
export default mount('/health', app);

/* OUTPUT */
// ~/Dev/repo/src/apps/health/server.js
export const server = mount('/health', app);
```

### use-named-imports

Naively convert a default import to a named import using the original name, which may not match what
the module is actually exporting. This codemod would need following up on with ESLint and some
manual fixes.

```js
/* INPUT */
import masthead from '@sky-uk/koa-masthead';

/* OUTPUT */
import { masthead } from '@sky-uk/koa-masthead';
```
