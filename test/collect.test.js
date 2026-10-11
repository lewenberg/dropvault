import assert from 'node:assert/strict'
import { fromInput } from '../src/lib/collect.js'
const f = (path, text = 'x') => Object.assign(new File([text], path.split('/').pop()), { webkitRelativePath: path })
const list = [
  f('proj/.gitignore', 'node_modules/\n*.log\ndist\n!keep.log\n'),
  f('proj/src/app.js'), f('proj/src/debug.log'), f('proj/keep.log'),
  f('proj/node_modules/x/index.js'), f('proj/dist/out.js'),
  f('proj/.git/HEAD'), f('proj/.DS_Store'),
  f('proj/pkg/.gitignore', 'secret.txt\n'), f('proj/pkg/secret.txt'), f('proj/pkg/ok.txt'), f('proj/secret.txt'),
]
const r = await fromInput(list)
assert.deepEqual(r.files.map((x) => x.path).sort(), ['proj/.gitignore', 'proj/keep.log', 'proj/pkg/.gitignore', 'proj/pkg/ok.txt', 'proj/secret.txt', 'proj/src/app.js'])
assert.equal(r.ignored, 6)
assert.deepEqual(r.folders, ['proj'])
console.log('ok: .gitignore filtering (nested files, negation, .git and .DS_Store)')
