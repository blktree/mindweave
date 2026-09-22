import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const manifest = await json('manifest.json');
const pkg = await json('package.json');
const versions = await json('versions.json');
assert.match(manifest.id, /^[a-z][a-z-]*$/);
assert(!manifest.id.includes('obsidian') && !manifest.id.endsWith('plugin'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.match(manifest.minAppVersion, /^\d+\.\d+\.\d+$/);
assert.equal(pkg.version, manifest.version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert(manifest.description.length <= 250 && manifest.description.endsWith('.'));
assert.equal(manifest.isDesktopOnly, true);
assert(manifest.name.trim() && manifest.author.trim());
if (manifest.fundingUrl) {
  for (const url of typeof manifest.fundingUrl === 'string' ? [manifest.fundingUrl] : Object.values(manifest.fundingUrl)) {
    assert.equal(new URL(url).protocol, 'https:');
  }
}
for (const file of ['main.js', 'styles.css', 'manifest.json', 'README.md', 'LICENSE', 'NOTICE']) {
  assert((await stat(new URL(file, import.meta.url))).size > 0, file);
}
const build = await json('build-inputs.json');
for (const path of Object.keys(build.inputs)) assert(path.startsWith('src/'), `Unexpected build input: ${path}`);
const allowed = new Set(['obsidian', '@codemirror/state', '@codemirror/view']);
for (const output of Object.values(build.outputs)) {
  for (const dependency of output.imports) assert(dependency.external && allowed.has(dependency.path), `Unexpected runtime dependency: ${dependency.path}`);
}
console.log('PASS: manifest, version map, release files and build dependencies.');
const license = await readFile(new URL('LICENSE', import.meta.url), 'utf8');
assert.equal(pkg.license, 'AGPL-3.0-only');
assert.equal((await json('package-lock.json')).packages[''].license, pkg.license);
assert(license.includes('GNU AFFERO GENERAL PUBLIC LICENSE') && license.includes('END OF TERMS AND CONDITIONS'));
assert((await readFile(new URL('NOTICE', import.meta.url), 'utf8')).includes('SPDX-License-Identifier: AGPL-3.0-only'));
assert((await readFile(new URL('main.js', import.meta.url), 'utf8')).startsWith('/*! MindWeave | Copyright (C) 2026 blktree | AGPL-3.0-only'));
console.log('PASS: AGPL-3.0-only license, notice, package metadata and build banner.');
console.log('Manual checks still required: repository ownership, ID availability, author, payment/source disclosures and Community Directory review.');
