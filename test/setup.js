const fs = require('fs');
const path = require('path');
const testUtils = require('jscodeshift/src/testUtils');

const fakePath = '/Users/you/Dev/my-project/src/some-file.js';

global.testTransform = (name, { filePath = fakePath, options = {} } = {}) => {
  describe(name, () => {
    const root = path.join(__dirname, '..');
    const transformPath = `${root}/transforms/${name}.js`;
    const fixturesPath = `${root}/test/fixtures/${name}`;

    if (!fs.existsSync(fixturesPath)) {
      it.skip('create tests in ./test/fixtures/<transform-name>/<scenario-name>.input.js', () => {});
      return;
    }

    fs.readdirSync(fixturesPath)
      .filter(filename => filename.endsWith('.input.js'))
      .map(filename => filename.replace('.input.js', ''))
      .forEach(id => {
        const inputPath = `${fixturesPath}/${id}.input.js`;
        const outputPath = `${fixturesPath}/${id}.output.js`;
        const displayPath = path.relative(root, inputPath);

        it(displayPath, () => {
          const transform = require(transformPath);
          const input = fs.readFileSync(inputPath, 'utf8');
          const expectedOutput = fs.readFileSync(outputPath, 'utf8');
          jest.spyOn(console, 'log').mockImplementation(() => {});
          testUtils.runInlineTest(
            transform,
            options,
            { path: filePath, source: input },
            expectedOutput
          );
          jest.restoreAllMocks();
        });
      });
  });
};
