import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CHECK = fileURLToPath(new URL('../scripts/check.mjs', import.meta.url))
const run = () => spawnSync(process.execPath, [CHECK], { encoding: 'utf8' })

test('scripts/check.mjs passes on the repo', () => {
  const r = run()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /ok —/)
})

test('check reports the expected inventory', () => {
  const r = run()
  assert.match(r.stdout, /4 skills, 3 MCP configs, 3 manifests, 2 marketplaces/)
})
