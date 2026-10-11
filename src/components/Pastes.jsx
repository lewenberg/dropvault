import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { bytes, when } from '../lib/format'

/** Firestore documents max out at 1 MiB; leave room for the rest. */
const MAX_PASTE = 900_000

export default function Pastes({ user }) {
  const [pastes, setPastes] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [open, setOpen] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'pastes'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setPastes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  async function save(e) {
    e.preventDefault()
    const size = new Blob([content]).size
    if (!content.trim()) return
    if (size > MAX_PASTE) return setNotice(`That's ${bytes(size)}; pastes are limited to ${bytes(MAX_PASTE)}. Upload it as a file instead.`)
    await addDoc(collection(db, 'users', user.uid, 'pastes'), {
      title: title.trim() || content.trim().split('\n')[0].slice(0, 60),
      content,
      size,
      createdAt: serverTimestamp(),
    })
    setTitle('')
    setContent('')
    setNotice('Saved.')
  }

  const copy = async (p) => (await navigator.clipboard.writeText(p.content), setNotice(`Copied “${p.title}”.`))

  function download(p) {
    const url = URL.createObjectURL(new Blob([p.content], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.title.replace(/[^\w.-]+/g, '-').slice(0, 50) || 'paste'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <form className="paste-form" onSubmit={save}>
        <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Paste text, code, logs…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save(e)}
          rows={8}
          spellCheck={false}
        />
        <div className="actions">
          <button type="submit" disabled={!content.trim()}>Save paste</button>
          <span className="muted">⌘/Ctrl + Enter</span>
        </div>
      </form>
      {notice && <p className="notice">{notice}</p>}

      <div className="list-head">
        <h2>Your pastes</h2>
        <span className="muted">{pastes.length}</span>
      </div>
      {pastes.length === 0 ? (
        <p className="empty">No pastes yet.</p>
      ) : (
        <ul className="list">
          {pastes.map((p) => (
            <li key={p.id} className="paste">
              <div className="paste-row">
                <button className="link meta" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <strong>{p.title}</strong>
                  <span className="muted">{bytes(p.size)} · {when(p.createdAt)}</span>
                </button>
                <button className="secondary" onClick={() => copy(p)}>Copy</button>
                <button className="secondary" onClick={() => download(p)}>.txt</button>
                <button className="ghost" onClick={() => confirm('Delete this paste?') && deleteDoc(doc(db, 'users', user.uid, 'pastes', p.id))} aria-label="Delete paste">✕</button>
              </div>
              {open === p.id && <pre>{p.content}</pre>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
