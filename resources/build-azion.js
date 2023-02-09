'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const babel = require('@babel/core');

const outDir = './dist';

const { readdirRecursive, showDirStats } = require('./utils');

function removeInvalidRuntimeCode(content) {
    let newContent = content.replace(
        'function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }',
        'function _isNativeFunction(fn) { return false; }'
    )
    newContent = newContent.replace(
        'function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }',
        'function _construct(Parent, args, Class) { _construct = Reflect.construct; return _construct.apply(null, arguments); }'
    )
    return newContent;
}

if (require.main === module) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir);

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join(outDir, filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (filepath.endsWith('.js')) {
      const flowBody = '// @flow strict\n' + fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(destPath + '.flow', flowBody);

      const cjsContent = babelBuild(srcPath, { envName: 'cjs' });
      const cjs = removeInvalidRuntimeCode(cjsContent);
      fs.writeFileSync(destPath, cjs);

      const mjsContent = babelBuild(srcPath, { envName: 'mjs' });
      const mjs = removeInvalidRuntimeCode(mjsContent);
      fs.writeFileSync(destPath.replace(/\.js$/, '.mjs'), mjs);
    } else if (filepath.endsWith('.d.ts')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  fs.copyFileSync('./LICENSE', outDir + '/LICENSE');
  fs.copyFileSync('./README.md', outDir + '/README.md');

  // Should be done as the last step so only valid packages can be published
  const packageJSON = buildPackageJSON();
  fs.writeFileSync(
    outDir + '/package.json',
    JSON.stringify(packageJSON, null, 2),
  );

  showDirStats(outDir);
}

function babelBuild(srcPath, options) {
  return babel.transformFileSync(srcPath, options).code + '\n';
}

function buildPackageJSON() {
  const packageJSON = require('../package.json');
  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  packageJSON.engines = packageJSON.engines_on_npm;
  delete packageJSON.engines_on_npm;

  // TODO: move to integration tests
  const publishTag = packageJSON.publishConfig?.tag;
  assert(publishTag != null, 'Should have packageJSON.publishConfig defined!');

  const { version } = packageJSON;
  const versionMatch = /^\d+\.\d+\.\d+-?(?<preReleaseTag>.*)?$/.exec(version);
  if (!versionMatch) {
    throw new Error('Version does not match semver spec: ' + version);
  }

  const { preReleaseTag } = versionMatch.groups;

  if (preReleaseTag != null) {
    const [tag] = preReleaseTag.split('.');
    assert(
      tag.startsWith('experimental-') || ['alpha', 'beta', 'rc'].includes(tag),
      `"${tag}" tag is supported.`,
    );
    assert.equal(tag, publishTag, 'Publish tag and version tag should match!');
  }

  return packageJSON;
}
