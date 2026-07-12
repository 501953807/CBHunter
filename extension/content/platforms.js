/* CBHunter Content Script v0.3 — platform-aware extraction
   Strategy: platform-specific selectors first → text-scanning fallback
   Supports: Shopee, TEMU, TikTok Shop, 1688
*/

const PLATFORM = (() => {
  const h = location.hostname
  if (h.includes('shopee')) return 'shopee'
  if (h.includes('temu.com')) return 'temu'
  if (h.includes('tiktok.com')) return 'tiktok'
  if (h.includes('1688.com')) return 'ali1688'
  return null
})()

/* ═══════════════════════════════════════
   PLATFORM-SPECIFIC SELECTORS
   ═══════════════════════════════════════ */

const SELECTORS = {
  shopee: {
    title: ['meta[property="og:title"]', 'div.attM6y span', 'h1', '[class*="product-title"]'],
    price: ['div.pqTWkA', '[class*="product-price"]', '[class*="price"]'],
    sales: ['div.e9Lw2Y', '[class*="sold"]', '[class*="sales"]'],
    images: [
      '._1IRPMe img', '.shopee-image-gallery__item img',
      '[class*="image-gallery"] img', '[class*="product-image"] img',
      '.product-page img', '#main-image img', '.gallery-preview-panel img',
    ],
    shop: ['div._3uf2jG', 'a[href*="shop"]', '[class*="shop-name"]', '[class*="seller"]'],
    rating: ['div._3yAlQ6', '[class*="rating"]', '[class*="star"]'],
    breadcrumb: ['.breadcrumb a', 'a._1MTuGp', '[class*="breadcrumb"] a'],
  },
  temu: {
    title: ['meta[property="og:title"]', 'h1', '[class*="product-title"]'],
    price: ['.product-price', '[class*="price"]', '.ProductPrice'],
    sales: ['.sales-count', '.sold-count', '[class*="sold"]', '[class*="sales"]'],
    images: [
      '.product-image img', '[class*="product-image"] img',
      '.gallery img', '[class*="gallery"] img', '.swiper-slide img',
      '[class*="ProductImage"] img', '.image-viewer img',
    ],
    shop: ['[class*="store"]', '[class*="shop"]', '[class*="seller"]'],
    rating: ['[class*="rating"]', '[class*="star"]'],
    breadcrumb: ['nav[aria-label*="breadcrumb"] a', '[class*="breadcrumb"] a'],
  },
  tiktok: {
    title: ['meta[property="og:title"]', 'h1[data-e2e="product-title"]', 'h1'],
    price: ['div[data-e2e="product-price"]', '[class*="price"]'],
    sales: ['.sold-count', '[class*="sold"]', '[data-e2e*="sold"]'],
    images: [
      '.swiper-slide img', '.product-gallery img', '[class*="gallery"] img',
      '[data-e2e="product-image"] img', '[class*="product-image"] img',
    ],
    shop: ['a[data-e2e="shop-name"]', '[class*="shop"]', '[class*="store"]'],
    rating: ['[class*="rating"]', '[class*="star"]', '[data-e2e*="rating"]'],
    breadcrumb: ['[class*="breadcrumb"] a'],
  },
  ali1688: {
    title: ['meta[property="og:title"]', '.product-name', 'h1'],
    price: ['.mod-detail-price', '.price', '[class*="price"]'],
    sales: ['.mod-detail-sale', '[class*="sold"]', '[class*="sales"]', '[class*="sale"]'],
    images: [
      '.mod-detail-gallery img', '.tab-content img', '.detail-gallery img',
      '[class*="gallery"] img', '[class*="product-image"] img', '.main-image img',
    ],
    shop: ['.supplier-name', '.company-name', '[class*="shop"]', '[class*="store"]'],
    rating: ['[class*="rating"]', '[class*="star"]', '[class*="level"]'],
    breadcrumb: ['.breadcrumb a', '[class*="breadcrumb"] a', '#nav-crumbs a'],
  },
}

/* ═══════════════════════════════════════
   EXTRACTOR HELPERS
   ═══════════════════════════════════════ */

function qFirst(selList, root) {
  for (const sel of selList) {
    try {
      const el = (root || document).querySelector(sel)
      if (el) return el
    } catch(e) { console.error('Invalid product selector', sel, e) }
  }
  return null
}

function qAll(selList) {
  for (const sel of selList) {
    try {
      const els = document.querySelectorAll(sel)
      if (els.length > 0) return els
    } catch(e) { console.error('Invalid product selector', sel, e) }
  }
  return []
}

function extractText(selList) {
  const el = qFirst(selList)
  return el ? el.textContent.trim() : ''
}

function extractProductSchema() {
  const nodes = document.querySelectorAll('script[type="application/ld+json"]')
  for (const node of nodes) {
    try {
      const parsed = JSON.parse(node.textContent || '{}')
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      const product = candidates.find(item => item?.['@type'] === 'Product')
      if (product) return product
    } catch(e) { console.error('Read product JSON-LD failed', e) }
  }
  return null
}

/* ── Title ── */
function extractTitle() {
  const schemaTitle = extractProductSchema()?.name
  if (typeof schemaTitle === 'string' && schemaTitle.trim().length > 3) return schemaTitle.trim()
  const sels = SELECTORS[PLATFORM]?.title || ['meta[property="og:title"]', 'h1']

  const og = document.querySelector('meta[property="og:title"]')
  if (og?.content) {
    let t = og.content.trim()
    t = t.replace(/\s*\|\s*(Shopee|TikTok|Temu|1688).*$/i, '')
    if (t.length > 5) return t
  }

  const heading = qFirst(sels)
  if (heading) {
    const t = heading.textContent.trim()
    if (t.length > 5 && t.length < 400 && !/cart|login|sign in|menu|search|404/i.test(t)) return t
  }

  const h1 = document.querySelector('h1')
  if (h1) { const t = h1.textContent.trim(); if (t.length > 3) return t }

  let t = document.title.trim()
  t = t.replace(/\s*\|\s*(Shopee|TikTok|Temu|1688).*$/i, '')
  return t
}

/* ── Price ── */
function extractPrice() {
  const schema = extractProductSchema()
  const offer = Array.isArray(schema?.offers) ? schema.offers[0] : schema?.offers
  const schemaPrice = parseFloat(offer?.price)
  if (Number.isFinite(schemaPrice) && schemaPrice > 0) return schemaPrice
  const sels = SELECTORS[PLATFORM]?.price || []
  const priceEl = qFirst(sels)
  if (priceEl) {
    const text = priceEl.textContent.trim()
    const nums = text.match(/[\d,.]+/g)
    if (nums) {
      for (const n of nums) {
        const v = parseFloat(n.replace(/,/g, ''))
        if (v > 0.01 && v < 1000000) return v
      }
    }
  }

  const body = (document.body?.innerText || '').slice(0, 5000)
  const pats = [
    /(?:RM|₱|S\$|NT\$|฿|₫|Rp|US\s*\$\s*|\$\s*|¥\s*)(\d{1,3}(?:[,.]\d{3})*(?:\.?\d{2})?)/gi,
    /([¥￥]\s*\d{1,3}(?:[,.]\d{3})*(?:\.?\d{2})?)/g,
  ]
  for (const pat of pats) {
    const ms = [...body.matchAll(pat)]
    for (const m of ms) {
      const raw = m[1] || m[0]
      const v = parseFloat(raw.replace(/[^\d.]/g, ''))
      if (v > 0.05 && v < 1000000) return v
    }
  }
  return null
}

function extractSales() {
  const sels = SELECTORS[PLATFORM]?.sales || []
  const el = qFirst(sels)
  if (el) {
    const text = el.textContent.trim()
    // Match: "28K+ sold", "10K+ bought", "8.5K sold", "已售 15,200 件"
    let m = text.match(/([\d,.]+)\s*[Kk]?\s*\+?\s*(?:sold|bought|sales|terjual|dijual|件)/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (/[Kk]/.test(text)) v *= 1000
      if (v > 0) return Math.round(v)
    }
    m = text.match(/已售\s*[:：]?\s*([\d,.]+)\s*(万|w)?/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (m[2]) v *= 10000
      if (v > 0) return Math.round(v)
    }
    m = text.match(/([\d,.]+)\s*(万|w|K|k|M|m)?/)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      const suffix = (m[2]||'').toLowerCase()
      if (suffix === '万' || suffix === 'w') v *= 10000
      else if (suffix === 'm') v *= 1000000
      else if (suffix === 'k') v *= 1000
      if (v > 0) return Math.round(v)
    }
  }

  const body = (document.body?.innerText || '').slice(0, 8000)
  const lines = body.split(/\n/)
  for (const line of lines) {
    let m = line.match(/已售\s*[:：]?\s*([\d,.]+)\s*(万|w)?/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (m[2]) v *= 10000
      if (v > 0) return Math.round(v)
    }
    m = line.match(/(?:terjual|dijual)\s*[:：]?\s*([\d,.]+)\s*([Kk]|rb|ribu)?/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (m[2]) v *= 1000
      if (v > 0) return Math.round(v)
    }
    m = line.match(/([\d,.]+)\s*[Kk]?\s*\+?\s*(?:sold|bought|sales)/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (/[Kk]/.test(line)) v *= 1000
      if (v > 0) return Math.round(v)
    }
    m = line.match(/(?:đã bán|da ban)\s*[:：]?\s*([\d,.]+)\s*([Kk])?/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (m[2]) v *= 1000
      if (v > 0) return Math.round(v)
    }
    m = line.match(/ขายแล้ว\s*[:：]?\s*([\d,.]+)\s*([Kk])?/i)
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''))
      if (m[2]) v *= 1000
      if (v > 0) return Math.round(v)
    }
  }
  return null
}

/* ── SKU — supports multi-variant detection ── */
function extractSKU() {
  const path = location.pathname
  let m

  m = path.match(/\/(?:product|item)\/(\d+)\/(\d+)/)
  if (m) return [m[1] + '.' + m[2]]
  m = path.match(/i\.(\d+)\.(\d+)/)
  if (m) return [m[1] + '.' + m[2]]

  m = path.match(/-g-(\d+)\.html/)
  if (m) return [m[1]]
  m = path.match(/-(\d{10,})\.html/)
  if (m) return [m[1]]

  m = path.match(/product\/(\d{8,})/)
  if (m) return [m[1]]

  m = path.match(/offer\/(\d+)\.html/)
  if (m) return [m[1]]

  const variants = []
  const variantSels = ['.product-variant', '[class*="variant"]', '[class*="sku"]', 'select[name*="variant"]', '.variation']
  for (const sel of variantSels) {
    try {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        if (el.tagName === 'SELECT') {
          for (const opt of el.options) {
            const t = opt.textContent.trim()
            if (t && !/choose|select|pilih|请选择/i.test(t) && t.length < 50) {
              variants.push(t)
            }
          }
        } else {
          const t = el.textContent.trim()
          if (t && t.length < 30) variants.push(t)
        }
      }
    } catch(e) { console.error('Read variant failed', sel, e) }
  }
  if (variants.length > 0) return variants

  // 1688: Try to extract from product specs / attributes table
  if (PLATFORM === 'ali1688') {
    // 1688 detail page: look for SKU in spec tables
    const specSelectors = [
      '.mod-detail-purchasing .unit-detail-spec-operator',
      '.mod-detail-sku',
      '[data-sku]',
      '[class*="sku"]',
      '.offer-attr-item',
      '.mod-detail-bd .obj-sku',
      '.mod-detail .obj-sku-item',
      '#mod-detail-sku .sku-item',
    ]
    for (const sel of specSelectors) {
      try {
        const els = document.querySelectorAll(sel)
        if (els.length > 0) {
          const skus = []
          for (const el of els) {
            // Try data attributes first
            const dataSku = el.getAttribute('data-sku') || el.getAttribute('data-value') || el.getAttribute('data-title')
            if (dataSku && dataSku.length < 50) skus.push(dataSku.trim())
            else {
              const t = el.textContent.trim()
              if (t && t.length < 50 && !/更多|全部|请选择|规格|颜色|尺码/i.test(t)) skus.push(t)
            }
          }
          if (skus.length > 0) return skus
        }
      } catch(e) { console.error('Read 1688 SKU failed', sel, e) }
    }
    // 1688: Try to extract product ID from URL as fallback SKU
    const path1688 = location.pathname
    const m1688 = path1688.match(/offer\/(\d+)\.html/)
    if (m1688) return [m1688[1]]
  }

  const text = (document.body?.innerText || '').slice(0, 3000)
  // 1688: also try Chinese SKU patterns
  const skuPattern1688 = PLATFORM === 'ali1688'
    ? /(?:货号|型号|SKU|商品ID|产品编号)[：:\s]*([A-Za-z0-9\u4e00-\u9fff-]{4,})/iu
    : /(?:SKU|Item\s*ID|商品ID|Product\s*Code)[：:\s]*([A-Za-z0-9-]{6,})/i
  m = text.match(skuPattern1688)
  if (m) return [m[1]]

  return []
}

/* ── Category — first level only ── */
function extractCategory() {
  const sels = SELECTORS[PLATFORM]?.breadcrumb || ['.breadcrumb a', '[class*="breadcrumb"] a']
  const links = qAll(sels)
  if (links.length > 0) {
    for (const link of links) {
      const t = link.textContent.trim()
      if (t && !/home|首页|beranda|utama|首頁|search|cart|keranjang/i.test(t) && t.length > 1 && t.length < 40) {
        return t
      }
    }
  }

  const bcLis = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div li a, [class*="breadcrumb"] li a')
  for (const a of bcLis) {
    const t = a.textContent.trim()
    if (t && !/home|首页/i.test(t) && t.length > 1 && t.length < 40) return t
  }

  const schemaBc = document.querySelectorAll('[itemtype*="BreadcrumbList"] [itemprop="itemListElement"] a [itemprop="name"]')
  for (const el of schemaBc) {
    const t = el.textContent.trim()
    if (t && !/home|首页/i.test(t) && t.length < 40) return t
  }

  return ''
}

/* ── Rating ── */
function extractRating() {
  const sels = SELECTORS[PLATFORM]?.rating || ['[class*="rating"]', '[class*="star"]']
  const el = qFirst(sels)
  if (el) {
    const t = el.textContent.trim()
    const nm = t.match(/(\d\.?\d?)/)
    if (nm) {
      const v = parseFloat(nm[1])
      if (v > 0 && v <= 5) return v
    }
  }
  return null
}

/* ── Shop Name ── */
function extractShopName() {
  const sels = SELECTORS[PLATFORM]?.shop || ['a[href*="shop"]', '[class*="shop-name"]', '[class*="seller"]', '[class*="store"]']
  const el = qFirst(sels)
  if (el) {
    const t = el.textContent.replace(/visit|shop|store|brand|品牌|toko|kedai|official/i, '').trim()
    if (t.length > 1 && t.length < 60) return t
  }
  return ''
}

function extractProductId() {
  const path = location.pathname
  let m = path.match(/\/(?:product|item)\/(\d+)\/(\d+)/)
  if (m) return `${m[1]}.${m[2]}`
  m = path.match(/i\.(\d+)\.(\d+)/)
  if (m) return `${m[1]}.${m[2]}`
  m = path.match(/offer\/(\d+)\.html/)
  if (m) return m[1]
  m = path.match(/product\/(\d{8,})/)
  if (m) return m[1]
  return ''
}

function extractShopUrl() {
  const el = qFirst([
    'a[href*="shop.1688.com"]',
    'a[href*="winport"]',
    '.company-name a',
    '.supplier-name a',
    'a[href*="/shop/"]',
    'a[href*="seller"]',
  ])
  return el?.href || ''
}

function extractSupplierRating() {
  if (PLATFORM !== 'ali1688') return ''
  const el = qFirst(['.supplier-rating', '[class*="supplier-rating"]', '[class*="supplier-level"]', '[class*="level"]'])
  const text = el?.textContent?.trim() || ''
  return text.length < 40 ? text : ''
}

function extractMoq() {
  if (PLATFORM !== 'ali1688') return null
  const el = qFirst(['.mod-detail-start-quantity', '.minimum-order-quantity', '[class*="start-quantity"]', '[class*="moq"]'])
  const text = el?.textContent || document.body?.innerText?.slice(0, 4000) || ''
  const match = text.match(/(\d+)\s*(?:件|个|只|pcs|piece|起批)/i)
  return match ? parseInt(match[1], 10) : null
}

function extractPriceRangeText() {
  const sels = SELECTORS[PLATFORM]?.price || []
  const text = qFirst(sels)?.textContent || ''
  const values = text.match(/\d[\d,.]*(?:\.\d+)?/g)
  if (!values || values.length < 2) return ''
  return `${values[0].replace(/,/g, '')}-${values[1].replace(/,/g, '')}`
}

function extractReviewCount() {
  const text = (document.body?.innerText || '').slice(0, 6000)
  const match = text.match(/([\d,.]+)\s*(?:reviews|review|评价|评论|ratings|评分)/i)
  if (!match) return null
  const value = parseFloat(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? Math.round(value) : null
}

function extractSpecs() {
  if (PLATFORM !== 'ali1688') return {}
  const specs = {}
  document.querySelectorAll('.offer-attr-item, .mod-detail-attributes tr, [class*="attribute"]').forEach(row => {
    const text = row.textContent?.trim() || ''
    const match = text.match(/^([^：:]{1,20})[：:]\s*(.{1,80})$/)
    if (!match) return
    const key = match[1].trim()
    const value = match[2].trim()
    if (!key || !value) return
    if (/材质|material/i.test(key)) specs.material = value
    else if (/重量|weight/i.test(key)) specs.weight = value
    else specs[key] = value
  })
  return specs
}

/* ── Images — aggressive multi-layer extraction ── */
function extractImages() {
  const seen = new Set()
  const urls = []

  function add(src) {
    if (!src || typeof src !== 'string') return
    if (!src.startsWith('http')) return
    if (/avatar|icon|logo|favicon|badge|flag|banner|pixel|tracker|analytics|1x1|50x50|60x60|30x30|40x40|qr|qrcode/i.test(src)) return
    const key = src.replace(/[?#].*$/, '').replace(/\/\d+x\d+(\/|$)/, '/')
    if (seen.has(key)) return
    seen.add(key)
    urls.push(src)
  }

  // Layer 1: og:image
  const og = document.querySelector('meta[property="og:image"]')
  if (og?.content) add(og.content)

  // Layer 2: Schema.org Product images
  const schema = extractProductSchema()
  const schemaImages = Array.isArray(schema?.image) ? schema.image : schema?.image ? [schema.image] : []
  schemaImages.forEach(add)

  // Layer 3: Platform-specific selectors
  if (PLATFORM) {
    const imgSels = SELECTORS[PLATFORM]?.images || []
    for (const sel of imgSels) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          add(el.src || el.getAttribute('data-src') || el.getAttribute('data-original'))
        })
      } catch(e) { console.error('Read product image failed', sel, e) }
    }
  }

  // Layer 4: Schema.org Product images
  document.querySelectorAll('[itemprop="image"]').forEach(el => {
    add(el.src || el.getAttribute('content') || el.href)
  })

  // Layer 5: Large images > 300px
  if (urls.length < 3) {
    document.querySelectorAll('img').forEach(img => {
      const w = img.naturalWidth || img.width || img.getAttribute('width') || 0
      const h = img.naturalHeight || img.height || img.getAttribute('height') || 0
      if (w === 0 && h === 0) {
        add(img.src || img.dataset.src || img.getAttribute('data-src') || img.getAttribute('data-original'))
      } else if (w >= 300 || h >= 300) {
        add(img.src || img.dataset.src || img.getAttribute('data-src'))
      }
    })
  }

  // Layer 6: Images in product area > 150px
  if (urls.length < 3) {
    const productArea = document.querySelector('main, [role="main"], #main, .main, article, [class*="product"], [class*="detail"]') || document.body
    productArea.querySelectorAll('img').forEach(img => {
      const w = img.naturalWidth || img.width || 0
      if (w > 150 || w === 0) {
        add(img.src || img.dataset.src || img.getAttribute('data-src'))
      }
    })
  }

  // Layer 7: Product-like URLs
  if (urls.length < 2) {
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.dataset.src || ''
      if (/product|item|goods|image|photo|picture|img|gallery/i.test(src)) add(src)
    })
  }

  // Layer 8: Last resort — all images >= 100px
  if (urls.length === 0) {
    const all = [...document.querySelectorAll('img')]
    for (const img of all) {
      const w = img.naturalWidth || img.width || 0
      if (w >= 100 || w === 0) add(img.src || img.dataset.src)
    }
  }

  console.log('[CBHunter] Extracted', urls.length, 'product image candidates')
  return urls.slice(0, 20)
}

/* ── Market Detection ── */
function detectMarket(h) {
  const map = {
    '.com.my': 'MY', '.ph': 'PH', '.sg': 'SG', '.co.th': 'TH',
    '.vn': 'VN', '.tw': 'TW', '.co.id': 'ID', '.br': 'BR',
    '.mx': 'MX', '.cl': 'CL', '.pl': 'PL', '.es': 'ES', '.fr': 'FR'
  }
  for (const [suffix, code] of Object.entries(map)) {
    if (h.includes(suffix)) return code
  }
  if (h.includes('1688.com')) return 'CN'
  return ''
}

function detectCurrency(market) {
  const schema = extractProductSchema()
  const offer = Array.isArray(schema?.offers) ? schema.offers[0] : schema?.offers
  if (offer?.priceCurrency) return offer.priceCurrency
  const map = {
    MY: 'MYR', PH: 'PHP', SG: 'SGD', TH: 'THB', VN: 'VND',
    TW: 'TWD', ID: 'IDR', US: 'USD', JP: 'JPY', CN: 'CNY',
    BR: 'BRL', MX: 'MXN'
  }
  return map[market] || ''
}

/* ═══════════════════════════════════════
   MAIN EXTRACTION
   ═══════════════════════════════════════ */

function extractAll() {
  const host = location.hostname
  const market = detectMarket(host)
  const currency = detectCurrency(market)
  const title = extractTitle()
  const price = extractPrice()
  const sales = extractSales()
  const skuList = extractSKU()
  const category = extractCategory()
  const rating = extractRating()
  const shop = extractShopName()
  const images = extractImages()
  const productId = extractProductId()

  const result = {
    platform: PLATFORM || (host.includes('1688') ? 'ali1688' : 'manual'),
    productId,
    productName: title,
    priceMin: price,
    priceMax: price,
    priceRangeText: extractPriceRangeText(),
    salesVolume: sales,
    sku: skuList.join(', '),
    skus: skuList,
    category,
    rating: Number.isFinite(rating) ? rating : null,
    reviewCount: extractReviewCount(),
    shopName: shop,
    shopUrl: extractShopUrl(),
    supplierRating: extractSupplierRating(),
    moq: extractMoq(),
    images,
    imageUrl: images[0] || '',
    market,
    currency,
    specs: extractSpecs(),
    productUrl: location.href,
    pageContent: document.body?.innerText?.slice(0, 3000) || '',
  }

  console.log('[CBHunter] ✅ Extraction complete:', {
    platform: result.platform,
    title: result.productName?.slice(0, 60),
    price: result.priceMin,
    sales: result.salesVolume,
    sku: result.sku,
    category: result.category,
    images: result.images.length + ' images',
    market: result.market,
    currency: result.currency,
  })

  return result
}

/* ── Message Handler ── */
chrome.runtime.onMessage.addListener((req, sender, send) => {
  if (req.type === 'GET_PAGE_INFO') {
    send(extractAll())
  }
  return true
})

/* ── Floating Collect Button ── */
if (PLATFORM) {
  const b = document.createElement('div')
  b.innerHTML = '📦'
  b.title = '采集到 CBHunter'
  b.style.cssText = 'position:fixed;bottom:100px;right:16px;z-index:99999;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#92174d,#e00b41);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;box-shadow:0 4px 16px rgba(146,23,77,0.4);transition:transform 0.2s;user-select:none'
  b.onmouseenter = () => b.style.transform = 'scale(1.15)'
  b.onmouseleave = () => b.style.transform = 'scale(1)'
  b.onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' })
  document.body.appendChild(b)
}
