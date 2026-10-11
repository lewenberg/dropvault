// Runs against the Firebase emulators: npm run test:emulators
import assert from 'node:assert/strict'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../src/lib/firebase.js'
import * as blobs from '../src/lib/blobstore.js'

// download() clicks a link; capture the blob instead.
let saved
globalThis.document = { createElement: () => ({ click() { saved = this } }) }
const urls = new Map()
URL.createObjectURL = (b) => (urls.set('blob:1', b), 'blob:1')
URL.revokeObjectURL = () => {}

const bytes = new Uint8Array(2_500_000).map((_, i) => (i * 31 + 7) % 251)
const blob = new Blob([bytes], { type: 'application/zip' })

const alice = await createUserWithEmailAndPassword(auth, `a${Date.now()}@test.dev`, 'test-only-pw')
const uid = alice.user.uid
const progress = []
const stored = await blobs.put(uid, 'f1', 'proj.zip', blob, (p) => progress.push(p))
assert.equal(stored.backend, 'firestore')
assert.equal(stored.chunks, 4)
assert.equal(progress.at(-1), 1)

await blobs.download(uid, { id: 'f1', name: 'proj.zip', ...stored })
assert.equal(saved.download, 'proj.zip')
const back = new Uint8Array(await urls.get(saved.href).arrayBuffer())
assert.deepEqual(back, bytes)
console.log('ok: 2.5 MB round trip in', stored.chunks, 'chunks')

// Another user can't read alice's chunks.
await signOut(auth)
await createUserWithEmailAndPassword(auth, `b${Date.now()}@test.dev`, 'test-only-pw')
await assert.rejects(getDoc(doc(db, 'users', uid, 'files', 'f1', 'chunks', '00000')), /permission/i)
console.log('ok: other users are denied')

await signOut(auth)
await (await import('firebase/auth')).signInWithEmailAndPassword(auth, alice.user.email, 'test-only-pw')
await blobs.remove(uid, { id: 'f1', ...stored })
assert.equal((await getDoc(doc(db, 'users', uid, 'files', 'f1', 'chunks', '00000'))).exists(), false)
console.log('ok: delete removes chunks')
process.exit(0)
