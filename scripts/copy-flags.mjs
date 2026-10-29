#!/usr/bin/env node
// Copies the country flags (small SVG pictures) from the `flag-icons` package into
// public/flags/, and writes the list of available codes to app/lib/flagCodes.ts.
// Flags are pictures instead of emoji because Windows cannot draw flag emoji (it
// shows letters like "SK"). Run:  npm run flags   (after updating the package)
// flag-icons is MIT licensed: https://github.com/lipis/flag-icons

import { mkdir, copyFile, readdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FROM = path.join(ROOT, 'node_modules', 'flag-icons')
const TO = path.join(ROOT, 'public', 'flags')
// Not countries (the EU, the UN, "unknown", cities, regions ...): left out.
const SKIP = new Set(['eu', 'un', 'xx'])

const files = (await readdir(path.join(FROM, 'flags', '4x3'))).filter((f) => /^[a-z]{2}\.svg$/.test(f))
const codes = files.map((f) => f.slice(0, 2)).filter((c) => !SKIP.has(c)).sort()

await mkdir(TO, { recursive: true })
for (const code of codes) await copyFile(path.join(FROM, 'flags', '4x3', `${code}.svg`), path.join(TO, `${code}.svg`))
await copyFile(path.join(FROM, 'LICENSE'), path.join(TO, 'LICENSE.txt'))

const list = codes.map((c) => `'${c}'`).join(', ')
await writeFile(
  path.join(ROOT, 'app', 'lib', 'flagCodes.ts'),
  `// Written by scripts/copy-flags.mjs (npm run flags). The flags that exist in public/flags/.\n\n` +
    `export const FLAG_CODES: ReadonlySet<string> = new Set([\n  ${list.replace(/(.{100,}?), /g, '$1,\n  ')},\n])\n`,
  'utf8'
)
const pkg = JSON.parse(await readFile(path.join(FROM, 'package.json'), 'utf8'))
console.log(`Copied ${codes.length} flags (flag-icons ${pkg.version}) to public/flags/ and listed them in app/lib/flagCodes.ts`)
