#!/usr/bin/env node
// Gets your own trip photos ready for the website:
//  - makes them smaller (longest side 2000 px) and saves them as WebP (much lighter than JPEG),
//  - turns them the right way up first (phones store "rotate me" as hidden information),
//  - REMOVES all hidden information (EXIF), including the GPS location where the photo was taken.
//
//   1. Put the original photos in   photos-inbox/<slug>/      (the slug of your trip or guide)
//   2. Run                          npm run optimize-photos -- <slug>
//   3. The ready photos appear in   public/trips/<slug>/      (use --kind=guides for guides)
//
// Other options:
//   --check          only check that the photos already in public/<kind>/<slug>/ contain no location data
//   --max=2000       longest side in pixels
//   --quality=80     WebP quality (1-100)
//
// The originals stay where they are. photos-inbox/ is ignored by git, so they are never committed.

import { readdir, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INPUT_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif'])

function parseArgs(argv) {
  const args = { slug: null, kind: 'trips', check: false, max: 2000, quality: 80, input: null, help: false }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--check') args.check = true
    else if (arg.startsWith('--kind=')) args.kind = arg.slice(7)
    else if (arg.startsWith('--max=')) args.max = Math.max(200, parseInt(arg.slice(6), 10) || 2000)
    else if (arg.startsWith('--quality=')) args.quality = Math.min(100, Math.max(1, parseInt(arg.slice(10), 10) || 80))
    else if (arg.startsWith('--in=')) args.input = path.resolve(arg.slice(5))
    else if (!arg.startsWith('--') && !args.slug) args.slug = arg
    else console.log(`Ignoring unknown option: ${arg}`)
  }
  return args
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

function cleanName(file) {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'photo'
}

/** True when the file still carries hidden camera information (EXIF, which includes GPS). */
async function hasHiddenData(file) {
  const meta = await sharp(file).metadata()
  return Boolean(meta.exif || meta.xmp || meta.iptc || meta.tifftagPhotoshop)
}

async function listFiles(dir, accept) {
  let names
  try {
    names = await readdir(dir)
  } catch {
    return null
  }
  return names.filter((n) => accept.has(path.extname(n).toLowerCase())).sort()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.slug) {
    console.log('Usage: npm run optimize-photos -- <slug> [--kind=guides] [--check]')
    console.log('Put the originals in photos-inbox/<slug>/ first. See the top of scripts/optimize-photos.mjs.')
    process.exitCode = args.help ? 0 : 1
    return
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) || !['trips', 'guides'].includes(args.kind)) {
    console.log('The slug must be lowercase letters, numbers and dashes, and --kind must be trips or guides.')
    process.exitCode = 1
    return
  }

  const outDir = path.join(ROOT, 'public', args.kind, args.slug)

  if (args.check) {
    const files = await listFiles(outDir, new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']))
    if (!files || files.length === 0) {
      console.log(`No photos found in public/${args.kind}/${args.slug}/`)
      process.exitCode = 1
      return
    }
    let bad = 0
    for (const f of files) {
      const dirty = await hasHiddenData(path.join(outDir, f))
      if (dirty) bad += 1
      console.log(`${dirty ? 'HAS LOCATION/CAMERA DATA' : 'clean'}  ${f}`)
    }
    if (bad) {
      console.log(`\n${bad} photo(s) still carry hidden data. Run npm run optimize-photos -- ${args.slug} on the originals again.`)
      process.exitCode = 1
    } else console.log('\nAll photos are clean.')
    return
  }

  const inDir = args.input ?? path.join(ROOT, 'photos-inbox', args.slug)
  const files = await listFiles(inDir, INPUT_TYPES)
  if (files === null) {
    console.log(`The folder ${path.relative(ROOT, inDir)} does not exist.`)
    console.log(`Create it, copy your original photos into it, and run this again.`)
    process.exitCode = 1
    return
  }
  if (files.length === 0) {
    console.log(`No photos (jpg, png, webp, tiff, avif) found in ${path.relative(ROOT, inDir)}.`)
    process.exitCode = 1
    return
  }

  await mkdir(outDir, { recursive: true })
  const used = new Set()
  const done = []
  let before = 0
  let after = 0

  for (const file of files) {
    const source = path.join(inDir, file)
    let name = cleanName(file)
    while (used.has(name)) name += '-2'
    used.add(name)
    const target = path.join(outDir, `${name}.webp`)
    try {
      // rotate() applies the phone's "turn me" note BEFORE the hidden data is dropped.
      // Not asking for metadata in the output means EXIF, GPS and the camera model are not written.
      const info = await sharp(source, { failOn: 'none' })
        .rotate()
        .resize({ width: args.max, height: args.max, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: args.quality })
        .toFile(target)
      if (await hasHiddenData(target)) throw new Error('hidden data is still in the result')
      const sizeBefore = (await stat(source)).size
      before += sizeBefore
      after += info.size
      done.push({ name: `${name}.webp`, width: info.width, height: info.height })
      console.log(`  ok  ${file}  ->  ${name}.webp  (${info.width}x${info.height}, ${kb(sizeBefore)} -> ${kb(info.size)}, location data removed)`)
    } catch (error) {
      console.log(`  !!  ${file}: ${error.message}`)
      process.exitCode = 1
    }
  }

  console.log(`\n${done.length} photo(s) ready in public/${args.kind}/${args.slug}/  (${kb(before)} -> ${kb(after)})`)
  if (done.length) {
    console.log('\nAdd them to the top of your Markdown file. Every photo needs a description (alt):\n')
    console.log('photos:')
    for (const d of done) {
      console.log(`  - src: ${d.name}`)
      console.log('    alt: "TODO: describe this photo in one sentence"')
      console.log('    caption: "Optional caption"')
    }
    console.log('\nChecklist before you publish: no recognisable faces of other people without their OK, no car number plates, no tickets or passport pages.')
  }
}

main().catch((error) => {
  console.error(`Stopped: ${error.message}`)
  process.exitCode = 1
})
