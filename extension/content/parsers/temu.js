import { normalizeProduct } from './base.js'
import { normalizeImages, parseCompactNumber, parseNumericPrice, readProductJsonLd } from './parser-utils.js'

export function parseTemuProduct(doc = document, currentUrl = window.location.href) {
  const schema = readProductJsonLd(doc)
  const offer = Array.isArray(schema?.offers) ? schema.offers[0] : schema?.offers
  const title = schema?.name
    || doc.querySelector('meta[property="og:title"]')?.content
    || doc.querySelector('h1')?.textContent
    || ''
  const images = normalizeImages(schema?.image)
  if (images.length === 0) {
    doc.querySelectorAll('[class*="gallery"] img, [class*="product"] img').forEach(img => {
      const src = img.src || img.getAttribute('data-src')
      if (src?.startsWith('http') && !images.includes(src)) images.push(src)
    })
  }
  const salesText = doc.querySelector('[class*="sold"], [class*="sales"]')?.textContent

  return normalizeProduct({
    source_platform: 'temu',
    source_url: currentUrl,
    title: String(title).trim(),
    price: parseNumericPrice(offer?.price || doc.querySelector('[class*="price"]')?.textContent),
    currency: offer?.priceCurrency || '',
    images,
    extra: {
      sales: parseCompactNumber(salesText),
      rating: schema?.aggregateRating?.ratingValue ? Number(schema.aggregateRating.ratingValue) : undefined,
      product_id: schema?.sku || schema?.productID || undefined,
      data_source: schema ? 'json_ld' : 'visible_dom',
    },
  })
}
