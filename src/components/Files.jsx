import { useEffect, useRef, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import * as blobs from '../lib/blobstore'
import { fromDrop, fromInput } from '../lib/collect'
import { zipFiles } from '../lib/zip'
import { bytes, when } from '../lib/format'

const { MAX_UPLOAD } = blobs

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

export default function Files({ user }) {
  const [items, setItems] = useState([])
  const [jobs, setJobs] = useState([])
  const [notice, setNotice] = useState('')
  const [over, setOver] = useState(false)
  const [bundle, setBundle] = useState(true)
  const fileInput = useRef(null)
  const folderInput = useRef(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'files'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  const updateJob = (id, patch) => setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...patch } : j)))

  async function put(name, blob, extra) {
    const id = crypto.randomUUID()
    if (blob.size > MAX_UPLOAD) {
      setNotice(`${name} is ${bytes(blob.size)}; the limit is ${bytes(MAX_UPLOAD)}.`)
      return
    }
    setJobs((all) => [...all, { id, name, progress: 0, stage: 'Uploading' }])
    try {
      const stored = await blobs.put(user.uid, id, name, blob, (p) => updateJob(id, { progress: p }))
      await setDoc(doc(db, 'users', user.uid, 'files', id), { name, size: blob.size, createdAt: serverTimestamp(), ...stored, ...extra })
    } catch (err) {
      setNotice(`Upload of ${name} failed: ${err.code || err.message}`)
    } finally {
      setJobs((all) => all.filter((j) => j.id !== id))
    }
  }

  async function handle({ files, folders, ignored }) {
    if (!files.length) {
      setNotice(ignored ? `Nothing to upload: all ${ignored} items are ignored by .gitignore.` : 'Nothing to upload.')
      return
    }
    setNotice(ignored ? `Skipped ${ignored.toLocaleString()} item${ignored === 1 ? '' : 's'} matched by .gitignore.` : '')
    // Folders always go up as one zip; loose files only when "bundle" is on.
    if (folders.length || (bundle && files.length > 1)) {
      const name = folders.length === 1 && files.every((f) => f.path.startsWith(folders[0] + '/')) ? `${folders[0]}.zip` : `bundle-${stamp()}.zip`
      const jobId = crypto.randomUUID()
      setJobs((all) => [...all, { id: jobId, name, progress: 0, stage: 'Zipping' }])
      try {
        const blob = await zipFiles(files, (p) => updateJob(jobId, { progress: p }))
        setJobs((all) => all.filter((j) => j.id !== jobId))
        await put(name, blob, { kind: 'zip', fileCount: files.length, ignored })
      } catch (err) {
        setJobs((all) => all.filter((j) => j.id !== jobId))
        setNotice(`Couldn't zip: ${err.message}`)
      }
    } else {
      await Promise.all(files.map(({ path, file }) => put(path, file, { kind: 'file', fileCount: 1 })))
    }
  }

  async function onDrop(e) {
    e.preventDefault()
    setOver(false)
    setNotice('Reading files…')
    handle(await fromDrop(e.dataTransfer))
  }

  async function onPick(e) {
    const list = e.target.files
    if (list?.length) {
      setNotice('Reading files…')
      handle(await fromInput(list))
    }
    e.target.value = ''
  }

  async function download(item) {
    setNotice(`Preparing ${item.name}…`)
    try {
      await blobs.download(user.uid, item)
      setNotice('')
    } catch (err) {
      setNotice(`Download failed: ${err.code || err.message}`)
    }
  }

  async function remove(item) {
    if (!confirm(`Delete ${item.name}?`)) return
    await blobs.remove(user.uid, item)
    await deleteDoc(doc(db, 'users', user.uid, 'files', item.id))
  }

  const total = items.reduce((n, i) => n + (i.size || 0), 0)

  return (
    <section>
      <div
        className={`drop ${over ? 'over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <div className="drop-icon">⇪</div>
        <p className="drop-title">Drop files or folders here</p>
        <p className="muted">Folders are zipped, and anything their .gitignore excludes is left out.</p>
        <div className="actions">
          <button onClick={() => fileInput.current.click()}>Choose files</button>
          <button className="secondary" onClick={() => folderInput.current.click()}>Choose folder</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={bundle} onChange={(e) => setBundle(e.target.checked)} />
          Zip multiple files into one bundle
        </label>
        <input ref={fileInput} type="file" multiple hidden onChange={onPick} />
        <input ref={folderInput} type="file" webkitdirectory="" hidden onChange={onPick} />
      </div>

      {notice && <p className="notice">{notice}</p>}

      {jobs.map((j) => (
        <div className="job" key={j.id}>
          <span>{j.stage} {j.name}</span>
          <progress value={j.progress} max="1" />
        </div>
      ))}

      <div className="list-head">
        <h2>Your files</h2>
        <span className="muted">{items.length} item{items.length === 1 ? '' : 's'} · {bytes(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing here yet. Upload something above.</p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li key={item.id}>
              <span className={`badge ${item.kind}`}>{item.kind === 'zip' ? 'ZIP' : 'FILE'}</span>
              <div className="meta">
                <strong title={item.name}>{item.name}</strong>
                <span className="muted">
                  {bytes(item.size)}
                  {item.kind === 'zip' && ` · ${item.fileCount} files`}
                  {item.ignored ? ` · ${item.ignored} ignored` : ''} · {when(item.createdAt)}
                </span>
              </div>
              <button className="secondary" onClick={() => download(item)}>Download</button>
              <button className="ghost" onClick={() => remove(item)} aria-label={`Delete ${item.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
