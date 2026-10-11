import { useEffect, useState } from 'react'
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { auth, configured, google } from './lib/firebase'
import Files from './components/Files'
import Pastes from './components/Pastes'

export default function App() {
  const [user, setUser] = useState(undefined)
  const [tab, setTab] = useState('files')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!configured) return setUser(null)
    // Finishes a redirect sign-in, if one was started.
    getRedirectResult(auth).catch((e) => setError(e.code || e.message))
    return onAuthStateChanged(auth, setUser)
  }, [])

  /** A popup when the browser allows one, otherwise a full-page redirect. */
  async function signIn() {
    if (signingIn) return
    setSigningIn(true)
    setError('')
    try {
      await signInWithPopup(auth, google)
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') return
      if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment', 'auth/internal-error'].includes(e.code)) {
        return signInWithRedirect(auth, google).catch((r) => setError(r.code || r.message))
      }
      setError(e.code || e.message)
    } finally {
      setSigningIn(false)
    }
  }

  if (!configured) {
    return (
      <main className="center">
        <h1>Dropvault</h1>
        <p className="muted">Firebase isn't configured. Set the VITE_FIREBASE_* variables (see .env.example).</p>
      </main>
    )
  }
  if (user === undefined) return <main className="center muted">Loading…</main>

  if (!user) {
    return (
      <main className="center landing">
        <div className="logo-mark">◈</div>
        <h1>Dropvault</h1>
        <p className="lede">Your private drop box and paste bin. Drag in files or whole project folders. .gitignore is respected, and folders come back as one zip.</p>
        <button className="google" onClick={signIn} disabled={signingIn}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <p className="error">Sign-in failed: {error}</p>}
      </main>
    )
  }

  return (
    <div className="shell">
      <header>
        <span className="brand">◈ Dropvault</span>
        <nav>
          <button className={tab === 'files' ? 'tab on' : 'tab'} onClick={() => setTab('files')}>Files</button>
          <button className={tab === 'pastes' ? 'tab on' : 'tab'} onClick={() => setTab('pastes')}>Pastes</button>
        </nav>
        <div className="me">
          {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
          <span className="name">{user.displayName || user.email}</span>
          <button className="ghost" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>
      <main>{tab === 'files' ? <Files user={user} /> : <Pastes user={user} />}</main>
    </div>
  )
}
