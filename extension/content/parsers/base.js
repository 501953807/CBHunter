/**
 * Unified product data model for all platforms.
 * Every parser MUST output this exact shape.
 *
 * @typedef {Object} CollectedProduct
 * @property {string} source_platform - shopee|temu|tiktok|ali1688
 * @property {string} source_url - canonical product URL
 * @property {string} title - product title
 * @property {number} price - numeric price in local currency
 * @property {string} currency - MYR|PHP|SGD|TWD|THB|VND|IDR|USD|CNY
 * @property {string[]} images - image URLs (at least 1)
 * @property {Object} extra - platform-specific fields
 * @property {string} [extra.shop_id] - Shopee shop ID
 * @property {number} [extra.voucher_price] - after-voucher price
 * @property {number} [extra.sales] - units sold
 * @property {number} [extra.rating] - 0-5 rating
 * @property {string} [extra.category_path] - breadcrumb
 * @property {Object} [extra.variants] - size/color options
 */

/**
 * Validate and normalize a collected product.
 * @param {Object} raw - raw parser output
 * @returns {{ valid: boolean, product?: Object, errors?: string[] }}
 */
export function normalizeProduct(raw) {
  const errors = [];

  if (!raw.source_platform) errors.push('Missing source_platform');
  if (!raw.source_url) errors.push('Missing source_url');
  if (!raw.title || !raw.title.trim()) errors.push('Missing title');
  if (raw.price == null || isNaN(raw.price)) errors.push('Invalid price');
  if (!raw.currency) errors.push('Missing currency');
  if (!raw.images || raw.images.length === 0) errors.push('Missing images');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    product: {
      source_platform: raw.source_platform,
      source_url: raw.source_url,
      title: raw.title.trim(),
      price: parseFloat(raw.price),
      currency: raw.currency,
      images: raw.images.slice(0, 20), // max 20 images
      extra: raw.extra || {},
    },
  };
}

/**
 * Send product to CBHunter backend.
 * @param {Object} product - normalized product
 * @returns {Promise<{ ok: boolean, data?: Object, error?: string }>}
 */
export async function sendToBackend(product) {
  try {
    // Try to get token from localStorage first, then chrome.storage
    let token = ''
    let serverUrl = ''
    try {
      const cfg = JSON.parse(localStorage.getItem('cbhunter_config') || '{}')
      token = cfg.token || ''
      serverUrl = cfg.serverUrl || ''
    } catch (error) {
      console.error('Load local extension config failed', error)
    }
    if (!token) {
      try {
        const result = await chrome.storage.local.get(['cbhunter_config'])
        token = result.cbhunter_config?.token || ''
        serverUrl = result.cbhunter_config?.serverUrl || serverUrl
      } catch (error) {
        console.error('Load browser extension config failed', error)
      }
    }
    if (!serverUrl) return { ok: false, error: 'Backend URL is not configured' }

    const headers = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = 'Bearer ' + token
    }

    const res = await fetch(`${serverUrl}/api/v1/collect/product`, {
      method: 'POST',
      headers,
      body: JSON.stringify(product),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.detail || `HTTP ${res.status}` };
    }
    return { ok: true, data: data.data };
  } catch (e) {
    return { ok: false, error: e.message || 'Network error' };
  }
}
