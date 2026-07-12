/* CBHunter Service Worker — context menus + message routing */

// Create right-click menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'cbhunter-image-to-sourcing',
    title: '📦 发送到 CBHunter 选品',
    contexts: ['image'],
  })
  chrome.contextMenus.create({
    id: 'cbhunter-page-to-signal',
    title: '💡 保存为文化信号到 CBHunter',
    contexts: ['page'],
  })
  chrome.contextMenus.create({
    id: 'cbhunter-collect-supplier',
    title: '🏪 采集供应商到 CBHunter',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.1688.com/*'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const cfg = await loadConfig()

  if (info.menuItemId === 'cbhunter-image-to-sourcing') {
    const name = tab?.title || '图片选品'
    try {
      await apiPost('/collect/product-image', cfg, {
        image_url: info.srcUrl,
        source_url: tab?.url || '',
        category: '',
        market: null,
        notes: `来自: ${tab?.url || ''}`,
      })
      notify('✅ 图片已发送到选品库')
    } catch (e) {
      notify('❌ 发送失败: ' + e.message)
    }
  }

  if (info.menuItemId === 'cbhunter-page-to-signal') {
    const content = await getPageContent(tab?.id)
    try {
      await apiPost('/collect/culture-signal', cfg, {
        title: tab?.title || '',
        content: content || '',
        source_url: tab?.url || '',
        source: 'browser_ext',
      })
      notify('✅ 页面已保存为文化信号')
    } catch (e) {
      notify('❌ 保存失败: ' + e.message)
    }
  }

  if (info.menuItemId === 'cbhunter-collect-supplier') {
    try {
      const pageData = await chrome.tabs.sendMessage(tab?.id, { type: 'GET_PAGE_INFO' })
      await apiPost('/collect/supplier', cfg, {
        supplier_name: pageData?.supplierName || pageData?.productName || tab?.title || '',
        product_name: pageData?.productName || '',
        purchase_price_rmb: pageData?.priceMin || null,
        supplier_url: tab?.url || '',
        product_image: pageData?.imageUrl || '',
        moq: pageData?.moq || null,
        rating: pageData?.rating || '',
        notes: `从1688采集: ${pageData?.productName || ''}`,
      })
      notify('✅ 供应商已采集')
    } catch (e) {
      notify('❌ 采集失败: ' + e.message)
    }
  }
})

// Open popup from floating button
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OPEN_POPUP') {
    chrome.action.openPopup()
  }
})

// ========== Helpers ==========

function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(['cbhunter_config'], result => {
      resolve(result.cbhunter_config || { serverUrl: 'http://localhost:8000', token: '' })
    })
  })
}

async function apiPost(endpoint, cfg, body) {
  const res = await fetch(`${cfg.serverUrl}/api/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function getPageContent(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText?.slice(0, 3000) || '',
    })
    return results[0]?.result || ''
  } catch (error) {
    console.error('Read page content failed', error)
    return ''
  }
}

function notify(msg) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'CBHunter',
    message: msg,
  })
}
