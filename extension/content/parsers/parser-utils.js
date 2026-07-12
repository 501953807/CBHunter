export function parseNumericPrice(value) {
  if (value == null) return undefined
  const matches = String(value).match(/\d[\d,.]*/g)
  if (!matches) return undefined
  for (const match of matches) {
    const normalized = match.includes(',') && !match.includes('.')
      ? match.replace(/,/g, '')
      : match.replace(/,/g, '')
    const parsed = Number.parseFloat(normalized)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function parseCompactNumber(value) {
  if (value == null) return undefined
  const match = String(value).match(/([\d,.]+)\s*(万|w|k|m|rb|ribu)?/i)
  if (!match) return undefined
  let parsed = Number.parseFloat(match[1].replace(/,/g, ''))
  if (!Number.isFinite(parsed)) return undefined
  const suffix = (match[2] || '').toLowerCase()
  if (suffix === '万' || suffix === 'w') parsed *= 10000
  else if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu') parsed *= 1000
  else if (suffix === 'm') parsed *= 1000000
  return Math.round(parsed)
}

export function readProductJsonLd(doc) {
  const nodes = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const node of nodes) {
    try {
      const parsed = JSON.parse(node.textContent || '{}')
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      const product = candidates.find(item => item?.['@type'] === 'Product')
      if (product) return product
    } catch (error) {
      console.error('Read product JSON-LD failed', error)
    }
  }
  return null
}

export function normalizeImages(images) {
  const values = Array.isArray(images) ? images : images ? [images] : []
  return [...new Set(values.filter(value => typeof value === 'string' && value.startsWith('http')))]
}
