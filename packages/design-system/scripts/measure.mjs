import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { relative } from 'node:path';

// Use the bundler already supplied by the workspace's Vite dependency.
const require = createRequire(import.meta.url);
const { rolldown } = await import(createRequire(require.resolve('vite')).resolve('rolldown'));
const root = new URL('../', import.meta.url).pathname;
const fixtures = ['react', 'elements', 'both', 'button', 'menu', 'tooltip', 'combobox', 'application'];
const results = {};

async function measure(name, withButton = false) {
    const entry = root + `fixtures/bundles/${name}.ts`;
    const bundle = await rolldown({
        input: entry,
        platform: 'browser',
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        moduleTypes: { '.css': 'empty' },
        transform: { jsx: 'react-jsx', target: 'es2022' },
        plugins: withButton
            ? [
                  {
                      name: 'retain-button-baseline',
                      transform(code, id) {
                          if (id === entry)
                              return `${code}\nimport {Button as BaselineButton} from ${JSON.stringify(root + 'src/react/button.ts')}; globalThis.platformButton = BaselineButton;`;
                      },
                  },
              ]
            : [],
    });
    try {
        const raw = await bundle.generate({ format: 'es', minify: false });
        const minified = await bundle.generate({ format: 'es', minify: true });
        const chunks = minified.output.filter((item) => item.type === 'chunk');
        if (chunks.length !== 1) throw new Error('Size fixtures must include all behaviour in one delivered chunk');
        const code = chunks[0].code;
        return {
            raw: Buffer.byteLength(
                raw.output
                    .filter((item) => item.type === 'chunk')
                    .map((item) => item.code)
                    .join(''),
            ),
            minified: Buffer.byteLength(code),
            gzip: gzipSync(code, { level: 9 }).length,
            brotli: brotliCompressSync(code).length,
            inputs: Object.keys(chunks[0].modules).map((path) =>
                path.startsWith('\0') ? path : relative(process.cwd(), path),
            ),
        };
    } finally {
        await bundle.close();
    }
}

for (const name of fixtures) {
    const result = await measure(name);
    const graph = result.inputs;
    if (graph.some((path) => path.includes('@base-ui'))) throw new Error('Forbidden runtime dependency');
    if (name === 'button' && graph.some((path) => /behaviours|elements|internal/.test(path)))
        throw new Error('Button imports interaction code');
    if (name === 'react' && graph.some((path) => path.includes('/elements/')))
        throw new Error('React imports registration');
    if (name === 'elements' && graph.some((path) => path.includes('/react/') || path.includes('node_modules')))
        throw new Error('Elements import a rendering runtime');
    results[name] = result;
}
for (const name of ['menu', 'tooltip', 'combobox']) {
    const combined = await measure(name, true);
    results[name].withButtonGzip = combined.gzip;
    results[name].incrementalGzip = combined.gzip - results.button.gzip;
}
const themeSHA256 = createHash('sha256')
    .update(readFileSync(root + 'src/styles/theme.css'))
    .digest('hex');
if (themeSHA256 !== JSON.parse(readFileSync(root + 'docs/baseline.json')).themeSHA256) throw new Error('Theme changed');
writeFileSync(
    root + 'docs/bundles.json',
    JSON.stringify({ bundler: 'workspace Vite/Rolldown', themeSHA256, results }, null, 2) + '\n',
);
process.stdout.write(
    JSON.stringify(Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.gzip])), null, 2) +
        '\n',
);
for (const name of ['react', 'elements', 'application'])
    if (results[name].gzip >= 20000) throw new Error(`${name} exceeds 20,000-byte gate`);
