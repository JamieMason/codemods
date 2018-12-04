const fs = require('fs');
const path = require('path');

// To write tests, create fixture files in the locations below and they
// will be discovered and run:
//
// ./test/fixtures/<transform-name>/<scenario-name>.input.js
// ./test/fixtures/<transform-name>/<scenario-name>.output.js

fs.readdirSync(path.resolve(__dirname, '../transforms'))
  .filter(filename => filename.endsWith('.js'))
  .map(filename => filename.replace('.js', ''))
  .forEach(transformName => {
    testTransform(transformName);
  });
