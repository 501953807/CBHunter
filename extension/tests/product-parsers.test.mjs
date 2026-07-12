import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProduct } from '../content/parsers/base.js'
import { parse1688Product } from '../content/parsers/alibaba1688.js'
import { parseTemuProduct } from '../content/parsers/temu.js'
import { parseTikTokShopProduct } from '../content/parsers/tiktok.js'

function productDocument(product, visible = {}) {
  const script = { textContent: JSON.stringify({ '@type': 'Product', ...product }) }
  return {
    querySelectorAll(selector) {
      return selector === 'script[type="application/ld+json"]' ? [script] : []
    },
    querySelector(selector) {
      return visible[selector] || null
    },
  }
}

test('TEMU parser uses structured product evidence', () => {
  const result = parseTemuProduct(productDocument({
    name: 'Real TEMU Product',
    image: ['https://example.com/temu.jpg'],
    sku: 'TEMU-1',
    offers: { price: '12.50', priceCurrency: 'USD' },
  }), 'https://www.temu.com/product.html')

  assert.equal(result.valid, true)
  assert.equal(result.product.price, 12.5)
  assert.equal(result.product.currency, 'USD')
  assert.equal(result.product.extra.product_id, 'TEMU-1')
})

test('TikTok Shop parser does not invent missing currency', () => {
  const result = parseTikTokShopProduct(productDocument({
    name: 'Real TikTok Product',
    image: 'https://example.com/tiktok.jpg',
    offers: { price: '8.90' },
  }), 'https://shop.tiktok.com/product/1')

  assert.equal(result.valid, false)
  assert.ok(result.errors.includes('Missing currency'))
})

test('normalized marketplace product preserves required evidence fields', () => {
  const result = normalizeProduct({
    source_platform: 'shopee',
    source_url: 'https://shopee.com.my/product/10/20',
    title: 'Real Shopee Product',
    price: 19.9,
    currency: 'MYR',
    images: ['https://example.com/product.jpg'],
    extra: {
      market: 'MY',
      product_id: '10.20',
      shop_name: 'Kuala Craft Store',
      sales: 1234,
      rating: 4.8,
      review_count: 82,
      category_path: 'Women Bags > Tote Bags',
    },
  })

  assert.equal(result.valid, true)
  assert.equal(result.product.extra.market, 'MY')
  assert.equal(result.product.extra.product_id, '10.20')
  assert.equal(result.product.extra.shop_name, 'Kuala Craft Store')
  assert.equal(result.product.extra.review_count, 82)
})

test('1688 parser captures supplier and supply-chain evidence', () => {
  const doc = {
    title: '真实 1688 帆布包 - 1688',
    querySelector(selector) {
      const nodes = {
        '.product-title, h1[data-testid="product-title"], .offer-title': { textContent: '真实 1688 帆布包' },
        '.price-text, .offer-price, .mod-price .value': { textContent: '¥18.50-22.00' },
        '.company-name, .supplier-name, .shop-name': { textContent: '义乌真实箱包厂' },
        '.company-address, .supplier-location, .location-text': { textContent: '浙江 金华' },
        '.mod-detail-start-quantity, .minimum-order-quantity': { textContent: '2件起批' },
        '.supplier-rating, [class*="supplier-rating"], [class*="supplier-level"]': { textContent: '5A' },
        'a[href*="shop.1688.com"], a[href*="winport"], .company-name a, .supplier-name a': {
          href: 'https://shop.1688.com/store.htm',
        },
      }
      return nodes[selector] || null
    },
    querySelectorAll(selector) {
      if (selector === '.detail-gallery-img img, .image-gallery img, .mod-detail-gallery img, img[data-src]') {
        return [{ src: 'https://img.example.com/1688.jpg', getAttribute: () => null }]
      }
      if (selector === '.breadcrumb a, .crumbs .crumb-item') {
        return [{ textContent: '箱包皮具' }, { textContent: '帆布包' }]
      }
      if (selector === '.offer-attr-item, .mod-detail-attributes tr, [class*="attribute"]') {
        return [
          { textContent: '材质：canvas' },
          { textContent: '重量：260g' },
        ]
      }
      return []
    },
  }

  const originalDocument = globalThis.document
  const originalWindow = globalThis.window
  globalThis.document = doc
  globalThis.window = { location: { href: 'https://detail.1688.com/offer/123.html' } }
  try {
    const result = parse1688Product()
    assert.equal(result.valid, true)
    assert.equal(result.product.source_platform, 'ali1688')
    assert.equal(result.product.extra.product_id, '123')
    assert.equal(result.product.extra.supplier_name, '义乌真实箱包厂')
    assert.equal(result.product.extra.shop_url, 'https://shop.1688.com/store.htm')
    assert.equal(result.product.extra.supplier_rating, '5A')
    assert.equal(result.product.extra.moq, 2)
    assert.equal(result.product.extra.price_range_text, '18.50-22.00')
    assert.equal(result.product.extra.specs.material, 'canvas')
  } finally {
    globalThis.document = originalDocument
    globalThis.window = originalWindow
  }
})
