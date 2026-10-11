// Turns dropped or picked files and folders into a flat list of
// { path, file }, skipping whatever each folder's .gitignore excludes.
import ignore from 'ignore'

const ALWAYS = ['.git/', '.DS_Store', 'Thumbs.db']

/** Whether `path` (a dir when it ends in '/') is excluded by any rule set. */
function excluded(path, rules) {
  for (const { base, ig } of rules) {
    if (base && !path.startsWith(base)) continue
    const rel = path.slice(base.length)
    if (rel && ig.ignores(rel)) return true
  }
  return false
}

const always = () => ({ base: '', ig: ignore().add(ALWAYS) })

// MARK: - Drag and drop (prunes ignored folders without reading them)

const readAll = (reader) =>
  new Promise((resolve, reject) => {
    const all = []
    const next = () =>
      reader.readEntries((batch) => (batch.length ? (all.push(...batch), next()) : resolve(all)), reject)
    next()
  })

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject))

async function walk(dir, base, rules, out, stats) {
  const entries = await readAll(dir.createReader())
  const gitignore = entries.find((e) => e.isFile && e.name === '.gitignore')
  if (gitignore) {
    const text = await (await fileOf(gitignore)).text()
    rules = [...rules, { base, ig: ignore().add(text) }]
  }
  for (const entry of entries) {
    const path = base + entry.name + (entry.isDirectory ? '/' : '')
    if (excluded(path, rules)) {
      stats.ignored++
      continue
    }
    if (entry.isDirectory) await walk(entry, path, rules, out, stats)
    else out.push({ path, file: await fileOf(entry) })
  }
}

/** From a drop: { files, folders: [names], ignored }. */
export async function fromDrop(dataTransfer) {
  const entries = [...dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean)
  const files = []
  const folders = []
  const stats = { ignored: 0 }
  for (const entry of entries) {
    if (entry.isDirectory) {
      folders.push(entry.name)
      await walk(entry, entry.name + '/', [always()], files, stats)
    } else {
      files.push({ path: entry.name, file: await fileOf(entry) })
    }
  }
  return { files, folders, ignored: stats.ignored }
}

// MARK: - File pickers

/** From an <input type=file> (with or without webkitdirectory). */
export async function fromInput(fileList) {
  const all = [...fileList].map((file) => ({ path: file.webkitRelativePath || file.name, file }))
  const folders = [...new Set(all.filter((f) => f.path.includes('/')).map((f) => f.path.split('/')[0]))]
  const rules = [always()]
  for (const { path, file } of all.filter((f) => f.path.endsWith('/.gitignore') || f.path === '.gitignore')) {
    rules.push({ base: path.slice(0, -'.gitignore'.length), ig: ignore().add(await file.text()) })
  }
  // Every ancestor folder has to be checked too (e.g. `node_modules/`).
  const kept = all.filter(({ path }) => {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      if (excluded(parts.slice(0, i).join('/') + '/', rules)) return false
    }
    return !excluded(path, rules)
  })
  return { files: kept, folders, ignored: all.length - kept.length }
}
