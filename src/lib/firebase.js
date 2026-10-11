import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const configured = Boolean(config.apiKey && config.projectId)
export const app = configured ? initializeApp(config) : null
export const auth = app && getAuth(app)
export const db = app && getFirestore(app)
export const storage = app && getStorage(app)
export const google = new GoogleAuthProvider()

// Local development and tests: `VITE_USE_EMULATORS=1` talks to the Firebase emulators.
if (app && import.meta.env.VITE_USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
