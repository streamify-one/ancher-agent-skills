#!/usr/bin/env node
// Assert the published tarball ships exactly the intended files and that the bin
// keeps its exec bit. Parses `npm pack --dry-run --json`. Pure Node built-ins.

import { execFileSync } from 'node:child_process'

const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' })
const [pkg] = JSON.parse(raw)
const paths = pkg.files.map(f => f.path)
const present = p => paths.some(x => x === p || x.startsWith(`${p.replace(/\/$/, '')}/`))

const required = [
  'plugins/',
  '.claude-plugin/',
  '.agents/',
  '.cursor/',
  'bin/cli.mjs',
  'scripts/check.mjs',
  'README.md',
  'LICENSE',
  'package.json',
]
const forbidden = ['node_modules/', '.git/', 'test/', 'docs/', '.github/', '.DS_Store']

const problems = []
for (const r of required) if (!present(r)) problems.push(`MISSING expected path: ${r}`)
for (const f of forbidden) {
  const base = f.replace(/\/$/, '')
  if (paths.some(p => p === base || p.startsWith(`${base}/`)))
    problems.push(`JUNK in tarball: ${f}`)
}

const bin = pkg.files.find(f => f.path === 'bin/cli.mjs')
if (!bin) problems.push('MISSING bin/cli.mjs')
else if ((bin.mode & 0o111) === 0)
  problems.push(
    `bin/cli.mjs is NOT executable (mode ${bin.mode.toString(8)}); run: git update-index --chmod=+x bin/cli.mjs`
  )

if (problems.length) {
  console.error('pack assertion FAILED:')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nTarball contents:')
  for (const p of paths) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`pack OK: ${pkg.filename} (${pkg.entryCount} files, ${pkg.unpackedSize} B unpacked)`)
for (const p of paths) console.log(`  ${p}`)
