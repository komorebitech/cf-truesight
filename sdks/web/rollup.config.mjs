import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const input = 'src/index.ts';

const plugins = [
  replace({
    preventAssignment: true,
    __SDK_VERSION__: JSON.stringify(pkg.version),
  }),
  resolve({ browser: true }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: 'dist',
  }),
  terser(),
];

export default [
  // ESM build
  {
    input,
    output: {
      file: 'dist/truesight.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins,
    external: ['fzstd'],
  },
  // CJS build
  {
    input,
    output: {
      file: 'dist/truesight.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins,
    external: ['fzstd'],
  },
  // UMD build (browser standalone)
  {
    input,
    output: {
      file: 'dist/truesight.umd.js',
      format: 'umd',
      name: 'TrueSight',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true,
      globals: {
        fzstd: 'fzstd',
      },
    },
    plugins,
  },
];
