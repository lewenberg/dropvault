import { zip } from 'fflate'

// Already compressed: storing them again just costs time.
const STORED = /\.(zip|gz|tgz|bz2|xz|7z|rar|jpe?g|png|gif|webp|avif|heic|mp3|mp4|mov|m4a|webm|pdf|woff2?)$/i

/** Zips [{ path, file }] into a Blob, reporting progress 0..1 while reading. */
export async function zipFiles(files, onProgress = () => {}) {
  const tree = {}
  let done = 0
  for (const { path, file } of files) {
    tree[path] = [new Uint8Array(await file.arrayBuffer()), { level: STORED.test(path) ? 0 : 6, mtime: file.lastModified }]
    onProgress(++done / files.length)
  }
  const bytes = await new Promise((resolve, reject) => zip(tree, (err, data) => (err ? reject(err) : resolve(data))))
  return new Blob([bytes], { type: 'application/zip' })
}
