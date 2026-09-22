import { build } from 'esbuild';
await build({ entryPoints: ['src/plugin.ts'], outfile: 'main.js', bundle: true,
  format: 'cjs', platform: 'browser', target: 'es2022', external: ['obsidian', '@codemirror/state', '@codemirror/view'],
  minify: false, legalComments: 'inline', metafile: true,
  banner: { js: '/*! MindWeave | Copyright (C) 2026 blktree | AGPL-3.0-only | No warranty. See LICENSE and NOTICE. Source: https://github.com/blktree/mindweave */' }
}).then(async result => {
  const { writeFile } = await import('node:fs/promises');
  await writeFile('build-inputs.json', JSON.stringify(result.metafile, null, 2));
});
