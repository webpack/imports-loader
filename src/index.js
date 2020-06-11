/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

import { SourceNode, SourceMapConsumer } from 'source-map';
import { getOptions, getCurrentRequest } from 'loader-utils';
import validateOptions from 'schema-utils';

import schema from './options.json';

import { getImports, renderImports } from './utils';

export default function loader(content, sourceMap) {
  const options = getOptions(this) || {};

  validateOptions(schema, options, {
    name: 'Imports loader',
    baseDataPath: 'options',
  });

  const type = options.type || 'module';
  const callback = this.async();

  let imports;

  try {
    imports = getImports(type, options);
  } catch (error) {
    callback(error);

    return;
  }

  const importsSorted = {};

  for (const item of imports) {
    if (!importsSorted[item.moduleName]) {
      importsSorted[item.moduleName] = [];
    }

    importsSorted[item.moduleName].push(item);
  }

  const importsCode = Object.entries(importsSorted).reduce((acc, item) => {
    return `${acc}${renderImports(this, type, item[1])}\n`;
  }, '');

  let finalImportsCode = `/*** IMPORTS FROM imports-loader ***/\n${importsCode}`;

  const { additionalCode } = options;

  if (additionalCode) {
    finalImportsCode += `\n${additionalCode}`;
  }

  let codeBeforeModule = '';
  let codeAfterModule = '';

  const { wrapper } = options;

  if (wrapper) {
    codeBeforeModule += '\n(function() {';
    codeAfterModule += `\n}.call(${wrapper.toString()}));`;
  }

  if (this.sourceMap && sourceMap) {
    const node = SourceNode.fromStringWithSourceMap(
      content,
      new SourceMapConsumer(sourceMap)
    );

    node.prepend(`${finalImportsCode}${codeBeforeModule}\n`);
    node.add(codeAfterModule);

    const result = node.toStringWithSourceMap({
      file: getCurrentRequest(this),
    });

    callback(null, result.code, result.map.toJSON());

    return;
  }

  callback(
    null,
    `${finalImportsCode}${codeBeforeModule}\n${content}${codeAfterModule}`,
    sourceMap
  );
}