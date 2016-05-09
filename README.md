# codemods

This repository contains a collection of codemod scripts for use with
[JSCodeshift](https://github.com/facebook/jscodeshift).

### Setup & Run

```sh
npm install -g jscodeshift
git clone https://github.com/JamieMason/codemods.git
jscodeshift -t <codemod-script> <file>
```

Use the `-d` option for a dry-run and use `-p` to print the output for
comparison.

### Included Scripts

#### `sort-jsx-props`

Sort props of JSX `<Component />` in A-Z order.

```sh
jscodeshift -t codemods/transforms/sort-jsx-props.js <file>
```

#### `sort-object-props`

Sort members of Object Literals in A-Z order.

```sh
jscodeshift -t codemods/transforms/sort-object-props.js <file>
```
