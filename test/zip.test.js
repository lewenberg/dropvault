import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { zipFiles } from '../src/lib/zip.js'

const file = (text) => new File([text], 'x')
const blob = await zipFiles([{ path: 'proj/src/a.js', file: file('console.log(1)') }, { path: 'proj/logo.png', file: file('PNGDATA') }])
const out = unzipSync(new Uint8Array(await blob.arrayBuffer()))
assert.deepEqual(Object.keys(out).sort(), ['proj/logo.png', 'proj/src/a.js'])
assert.equal(strFromU8(out['proj/src/a.js']), 'console.log(1)')
console.log('ok: folder zip round trip')
