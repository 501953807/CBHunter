/* CBHunter Popup v0.3 — form-based collection with image grid selection */

const $ = id => document.getElementById(id)
const LS_KEY = 'cbhunter_config'
const MAX_IMAGES = 10

const CURRENCY_LABELS = {
  MYR: 'RM', PHP: '₱', SGD: 'S$', TWD: 'NT$', THB: '฿',
  VND: '₫', IDR: 'Rp', USD: '$', CNY: '¥', JPY: '¥'
}

function loadCfg() { try { return JSON.parse(localStorage.getItem(LS_KEY))||{} } catch (error) { console.error('Load extension config failed', error); return {} } }
function saveCfg(cfg) { localStorage.setItem(LS_KEY, JSON.stringify(cfg)) }
function getToken() {
  // Prefer localStorage (popup login). Fall back to chrome.storage (service worker).
  const cfg = loadCfg()
  if (cfg.token) return cfg.token
  // Try sync-read from chrome.storage (blocking in popup context)
  return ''
}

let pageData = null
let availableImgs = []
let selectedIdx = new Set()

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  const cfg = loadCfg()
  if (cfg.token) { $('loginBox').classList.add('hidden'); $('mainForm').classList.remove('hidden') }
  if (cfg.serverUrl && !$('serverUrl').value) $('serverUrl').value = cfg.serverUrl

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' })
      if (resp && resp.productName) { pageData = resp; fillForm(resp) }
      else setManual(tab)
    } catch(e) { setManual(tab) }
  }

  // Login
  $('loginBtn').addEventListener('click', async () => {
    const url = $('serverUrl').value.replace(/\/+$/, '')
    const u = $('loginUser').value.trim(), p = $('loginPass').value.trim()
    if (!u||!p) { toast('loginStatus', '请填写用户名和密码', 'err'); return }
    toast('loginStatus', '登录中...', 'info')
    try {
      const r = await fetch(url + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      })
      const d = await r.json()
      const tok = d?.data?.token?.access_token || d?.data?.token
      if (tok) {
        saveCfg({ serverUrl: url, token: tok })
        chrome.storage.local.set({ cbhunter_config: { serverUrl: url, token: tok } })
        toast('loginStatus', '✅ 登录成功', 'ok')
        setTimeout(() => location.reload(), 400)
      } else {
        const msg = typeof d.detail === 'string' ? d.detail : JSON.stringify(d).slice(0, 120)
        toast('loginStatus', '登录失败: ' + msg, 'err')
      }
    } catch(e) { toast('loginStatus', '连接失败: ' + e.message, 'err') }
  })

  $('prodPrice').addEventListener('input', updateCNY)
  document.getElementById('marketSelect')?.addEventListener('change', updateCNY)
  $('collectBtn').addEventListener('click', doCollect)
})

/* ── Fill form ── */
function fillForm(data) {
  const pf = data.platform || 'manual'
  const labels = { shopee: '🟠 Shopee', tiktok: '⚫ TikTok', temu: '🔴 TEMU', ali1688: '🟠 1688' }
  const badge = $('platformBadge')
  badge.className = 'platform-badge ' + (pf || 'unknown')
  badge.textContent = (labels[pf] || '🌐 手动') + (data.market ? ' · ' + data.market : '')

  $('prodTitle').value = data.productName || ''
  $('prodPrice').value = data.priceMin || ''
  $('prodSales').value = data.salesVolume || ''
  $('prodSKU').value = data.sku || ''
  $('prodRating').value = data.rating || ''
  $('prodShop').value = data.shopName || ''
  $('prodCategory').value = data.category || ''

  // Market dropdown — force CN for 1688 since price is already RMB
  const mkt = $('marketSelect')
  const isAli = data.platform === 'ali1688'
  if (mkt && data.market) mkt.value = isAli ? 'CN' : data.market

  updateCNY()

  // Images: deduplicate + build grid
  const imgs = (data.images || []).filter(u => u && u.startsWith('http'))
  availableImgs = [...new Set(imgs.map(u => u.split('?')[0]))]
    .map(base => imgs.find(u => u.startsWith(base)))
    .filter(Boolean)
    .slice(0, 20)

  // Default: select first 5 (or all if fewer)
  selectedIdx = new Set()
  const n = Math.min(MAX_IMAGES, availableImgs.length, 5)
  for (let i = 0; i < n; i++) selectedIdx.add(i)

  renderImgs()
  $('pageStatus').textContent = pf ? (labels[pf] || pf) + ' 已识别' : '手动模式'
  $('collectBtn').disabled = false
}

function setManual(tab) {
  pageData = { platform: 'manual', market: '', productName: tab?.title || '', productUrl: tab?.url || '' }
  $('prodTitle').value = tab?.title || ''
  $('platformBadge').className = 'platform-badge unknown'
  $('platformBadge').textContent = '🌐 手动录入'
  $('pageStatus').textContent = '非电商页面（手动模式）'
  availableImgs = []; selectedIdx = new Set(); renderImgs()
  $('collectBtn').disabled = false
}

/* ── Image Grid ── */
function renderImgs() {
  const grid = $('imgGrid')
  if (!availableImgs.length) {
    grid.innerHTML = '<span style="font-size:11px;color:#aaa;padding:8px;">打开商品页后自动提取...</span>'
    $('imgCount').textContent = '0'
    return
  }
  grid.innerHTML = availableImgs.map((url, i) =>
    `<div class="img-thumb${selectedIdx.has(i)?' selected':''}" data-idx="${i}">
      <img src="${url}" onerror="this.style.display='none'" loading="lazy">
      <div class="check">✓</div>
    </div>`
  ).join('')

  grid.querySelectorAll('.img-thumb').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx)
      if (selectedIdx.has(idx)) {
        selectedIdx.delete(idx)
      } else {
        if (selectedIdx.size >= MAX_IMAGES) {
          const first = [...selectedIdx][0]
          selectedIdx.delete(first)
        }
        selectedIdx.add(idx)
      }
      renderImgs()
    })
  })

  $('imgCount').textContent = selectedIdx.size
}

function updateCNY() {
  const price = parseFloat($('prodPrice').value)
  if (isNaN(price)) { $('prodPriceCNY').value = ''; return }
  const market = $('marketSelect')?.value || pageData?.market || ''
  // 1688 / China: price is already CNY, no conversion
  if (market === 'CN' || pageData?.platform === 'ali1688') {
    $('prodPriceCNY').value = '¥' + price.toFixed(2)
    return
  }
  $('prodPriceCNY').value = '待系统汇率'
}

/* ── Collect ── */
async function doCollect() {
  let cfg = loadCfg()
  // If token not in localStorage, try chrome.storage (popup opened from content script button)
  if (!cfg.token) {
    try {
      const stored = await chrome.storage.local.get(['cbhunter_config'])
      cfg = stored.cbhunter_config || cfg
    } catch(e) { console.error('Load extension storage config failed', e) }
  }
  if (!cfg.token) { toast('collectStatus', '请先登录', 'err'); return }
  const title = $('prodTitle').value.trim()
  if (!title) { toast('collectStatus', '请填写商品标题', 'err'); return }
  if (selectedIdx.size === 0) { toast('collectStatus', '请至少选择1张图片', 'err'); return }

  $('collectBtn').disabled = true; $('collectBtn').textContent = '⏳ 采集中...'

  const parsedPrice = parseFloat($('prodPrice').value)
  const price = Number.isFinite(parsedPrice) ? parsedPrice : null
  const market = $('marketSelect')?.value || pageData?.market || ''
  const selectedUrls = [...selectedIdx].sort().map(i => availableImgs[i])
  const platform = pageData?.platform || 'manual'
  const is1688 = platform === 'ali1688'

  // All platforms use the same hot-product endpoint
  // 1688 products get tagged with source_type for routing
  const endpoint = '/api/v1/collect/hot-product'
  const successMsg = is1688 ? '✅ 采集成功！已添加到供应链' : '✅ 采集成功！已添加到电商热卖'

  const body = {
    platform: platform,
    market: is1688 ? 'CN' : market,
    product_name: title,
    price_min: price || null,
    price_max: price || null,
    sales_volume: Number.isFinite(parseInt($('prodSales').value)) ? parseInt($('prodSales').value) : null,
    product_url: pageData?.productUrl || '',
    image_url: selectedUrls[0] || '',
    images: selectedUrls,
    product_id: pageData?.productId || '',
    sku: $('prodSKU').value.trim(),
    shop_name: $('prodShop').value.trim(),
    shop_url: pageData?.shopUrl || '',
    supplier_rating: pageData?.supplierRating || '',
    price_range_text: pageData?.priceRangeText || '',
    moq: pageData?.moq || null,
    rating: parseFloat($('prodRating').value) || null,
    review_count: pageData?.reviewCount || null,
    category_path: $('prodCategory').value.trim(),
    tags: is1688 ? ['supply_chain'] : [],
    extra_data: {
      currency: pageData?.currency || '',
      specs: pageData?.specs || {},
      skus: pageData?.skus || [],
      image_count: selectedUrls.length,
    },
  }

  try {
    const r = await fetch(cfg.serverUrl + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.token },
      body: JSON.stringify(body)
    })
    const d = await r.json()
    if (r.ok) {
      toast('collectStatus', successMsg, 'ok')
      $('prodTitle').value = ''; $('prodPrice').value = ''; $('prodPriceCNY').value = ''
      $('prodSales').value = ''; $('prodSKU').value = ''; $('prodRating').value = ''
      $('prodShop').value = ''; $('prodCategory').value = ''
      availableImgs = []; selectedIdx = new Set(); renderImgs()
    } else {
      const msg = typeof d.detail === 'string' ? d.detail : JSON.stringify(d).slice(0, 120)
      toast('collectStatus', '❌ ' + msg, 'err')
    }
  } catch(e) { toast('collectStatus', '网络错误: ' + e.message, 'err') }
  $('collectBtn').disabled = false; $('collectBtn').textContent = '📥 采集到 CBHunter'
}

function toast(id, msg, type) {
  const el = $(id); el.className = 'status ' + type; el.textContent = msg
  if (type === 'ok') setTimeout(() => { el.className = 'status'; el.style.display = 'none' }, 3000)
}
