// Where file bytes live. Two backends:
// - "firestore" (default): each file is split into ~700 KB chunks stored as
//   documents under users/{uid}/files/{id}/chunks/. Works on Firebase's free
//   Spark plan (1 GiB stored), no billing account needed.
// - "storage": Cloud Storage for Firebase (needs the Blaze plan for a bucket).
// Set VITE_FILE_BACKEND=storage to use the bucket.
import { Bytes, collection, doc, getDocs, orderBy, query, setDoc, writeBatch } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from './firebase'

export const backend = import.meta.env.VITE_FILE_BACKEND === 'storage' ? 'storage' : 'firestore'

/** Per-file limit: 200 MB with a bucket, 50 MB in Firestore (it's 1 GiB in all). */
export const MAX_UPLOAD = (backend === 'storage' ? 200 : 50) * 1024 * 1024

/** Firestore documents max out at 1 MiB. */
const CHUNK = 700 * 1024
/** Chunks written at once. */
const PARALLEL = 4

const chunks = (uid, id) => collection(db, 'users', uid, 'files', id, 'chunks')

/** Stores `blob`; returns the fields to keep on the file's record. */
export async function put(uid, id, name, blob, onProgress) {
  if (backend === 'storage') {
    const path = `users/${uid}/files/${id}/${name}`
    const task = uploadBytesResumable(ref(storage, path), blob, {
      contentType: blob.type || 'application/octet-stream',
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    })
    task.on('state_changed', (s) => onProgress(s.bytesTransferred / s.totalBytes))
    await task
    return { backend, path }
  }
  const count = Math.max(1, Math.ceil(blob.size / CHUNK))
  let done = 0
  let next = 0
  async function worker() {
    while (next < count) {
      const i = next++
      const part = new Uint8Array(await blob.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer())
      await setDoc(doc(chunks(uid, id), String(i).padStart(5, '0')), { i, data: Bytes.fromUint8Array(part) })
      onProgress(++done / count)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, count) }, worker))
  return { backend, chunks: count, type: blob.type || 'application/octet-stream' }
}

/** Saves the file to the user's downloads. */
export async function download(uid, item) {
  if (item.backend === 'storage' || item.path) {
    clickLink(await getDownloadURL(ref(storage, item.path)), item.name)
    return
  }
  const snap = await getDocs(query(chunks(uid, item.id), orderBy('i')))
  const parts = snap.docs.map((d) => d.data().data.toUint8Array())
  const url = URL.createObjectURL(new Blob(parts, { type: item.type || 'application/octet-stream' }))
  clickLink(url, item.name)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Deletes the file's bytes (not its record). */
export async function remove(uid, item) {
  if (item.backend === 'storage' || item.path) {
    await deleteObject(ref(storage, item.path)).catch((err) => {
      if (err.code !== 'storage/object-not-found') throw err
    })
    return
  }
  const snap = await getDocs(chunks(uid, item.id))
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

function clickLink(href, name) {
  const a = document.createElement('a')
  a.href = href
  a.download = name.split('/').pop()
  a.click()
}
