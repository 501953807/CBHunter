import { normalizeProduct } from './base.js'
import { normalizeImages, parseCompactNumber, parseNumericPrice, readProductJsonLd } from './parser-utils.js'

export function parseTikTokShopProduct(doc = document, currentUrl = window.location.href) {
  const schema = readProductJsonLd(doc)
  const offer = Array.isArray(schema?.offers) ? schema.offers[0] : schema?.offers
  const title = schema?.name
    || doc.querySelector('meta[property="og:title"]')?.content
    || doc.querySelector('[data-e2e="product-title"], h1')?.textContent
    || ''
  const images = normalizeImages(schema?.image)
  if (images.length === 0) {
    doc.querySelectorAll('[data-e2e="product-image"] img, [class*="gallery"] img, [class*="product-image"] img').forEach(img => {
      const src = img.src || img.getAttribute('data-src')
      if (src?.startsWith('http') && !images.includes(src)) images.push(src)
    })
  }
  const salesText = doc.querySelector('[data-e2e*="sold"], [class*="sold"], [class*="sales"]')?.textContent

  return normalizeProduct({
    source_platform: 'tiktok',
    source_url: currentUrl,
    title: String(title).trim(),
    price: parseNumericPrice(offer?.price || doc.querySelector('[data-e2e="product-price"], [class*="price"]')?.textContent),
    currency: offer?.priceCurrency || '',
    images,
    extra: {
      sales: parseCompactNumber(salesText),
      rating: schema?.aggregateRating?.ratingValue ? Number(schema.aggregateRating.ratingValue) : undefined,
      shop_name: doc.querySelector('[data-e2e="shop-name"], [class*="shop-name"]')?.textContent?.trim() || undefined,
      product_id: schema?.sku || schema?.productID || undefined,
      data_source: schema ? 'json_ld' : 'visible_dom',
    },
  })
}
