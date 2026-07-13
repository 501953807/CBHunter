export function productImageSrc(src?: string | null) {
  if (!src) return ''
  const trimmed = src.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    return `/api/v1/products/image-proxy?url=${encodeURIComponent(trimmed)}`
  }
  return trimmed
}
