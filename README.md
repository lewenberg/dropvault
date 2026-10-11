# Dropvault

A private drop box and paste bin: sign in with Google, drag in files or whole
folders (each folder's `.gitignore` is respected, folders are uploaded as one
zip), download them later, and keep text snippets.

- Frontend: Vite + React, hosted on Vercel (Hobby, free)
- Auth: Firebase Authentication (Google provider)
- Files: by default stored in Firestore as ~700 KB chunks (free Spark plan, 50 MB per file, 1 GiB total). Set `VITE_FILE_BACKEND=storage` to use a Cloud Storage bucket instead (needs the Blaze plan; 200 MB per file)
- File list and pastes: Cloud Firestore, under `users/{uid}/`
- Access control: `firestore.rules` and `storage.rules` (paste them into the Firebase console)

Copy `.env.example` to `.env` and fill it in from the Firebase web app config, then `npm run dev`.

Tests: `npm test` (.gitignore filtering, zipping) and `npm run test:emulators`
(upload, download, delete and access rules against the Firebase emulators; needs Java 17+).
