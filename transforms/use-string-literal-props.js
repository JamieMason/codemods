export default (file, api) => {
  const j = api.jscodeshift;

  const withoutStringLiterals = j(file.source)
    .find(j.JSXAttribute)
    .filter((path) => {
      return (
        path.value &&
        path.value.value &&
        path.value.value.expression &&
        path.value.value.type === 'JSXExpressionContainer' &&
        path.value.value.expression.type === 'StringLiteral'
      );
    })
    .forEach((path) => {
      path.value.value = j.stringLiteral(path.value.value.expression.value);
    })
    .toSource();

  const withoutTemplateLiterals = j(withoutStringLiterals)
    .find(j.JSXAttribute)
    .filter((path) => {
      return (
        path.value &&
        path.value.value &&
        path.value.value.expression &&
        path.value.value.type === 'JSXExpressionContainer' &&
        path.value.value.expression &&
        path.value.value.expression.type === 'TemplateLiteral' &&
        path.value.value.expression.expressions &&
        path.value.value.expression.expressions.length === 0 &&
        path.value.value.expression.quasis &&
        path.value.value.expression.quasis[0] &&
        path.value.value.expression.quasis[0].value
      );
    })
    .forEach((path) => {
      path.value.value = j.stringLiteral(path.value.value.expression.quasis[0].value.raw);
    })
    .toSource();

  return withoutTemplateLiterals;
};
