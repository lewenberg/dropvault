export function bytes(n = 0) {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let i = -1
  do { n /= 1024; i++ } while (n >= 1024 && i < units.length - 1)
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`
}

export function when(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null
  return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'just now'
}
