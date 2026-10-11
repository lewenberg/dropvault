# Dropvault

A private drop box and paste bin: sign in with Google, drag in files or whole
folders (each folder's `.gitignore` is respected, folders are uploaded as one
zip), download them later, and keep text snippets.

- Frontend: Vite + React, hosted on Vercel (Hobby, free)
- Auth: Firebase Authentication (Google provider)
- Files: Cloud Storage for Firebase, under `users/{uid}/`
- File list and pastes: Cloud Firestore, under `users/{uid}/`
- Access control: `firestore.rules` and `storage.rules` (paste them into the Firebase console)

Copy `.env.example` to `.env` and fill it in from the Firebase web app config, then `npm run dev`.
