/**
 * 1688 (Alibaba China) product parser.
 */
import { normalizeProduct } from './base.js';

export function parse1688Product() {
  const result = { source_platform: 'ali1688' };

  result.source_url = window.location.href;

  // Title
  const titleEl = document.querySelector('.product-title, h1[data-testid="product-title"], .offer-title');
  result.title = titleEl?.textContent?.trim() || document.title?.split('-')[0]?.trim() || '';

  // Price — 1688 shows price range or unit price
  const priceEl = document.querySelector('.price-text, .offer-price, .mod-price .value');
  let priceText = priceEl?.textContent?.replace(/[^0-9.\-]/g, '') || '';
  // If price range like "12.50-25.00", take the lower
  if (priceText.includes('-')) {
    priceText = priceText.split('-')[0];
  }
  const parsedPrice = parseFloat(priceText);
  result.price = Number.isFinite(parsedPrice) ? parsedPrice : undefined;
  result.currency = 'CNY';

  // Images
  const imgEls = document.querySelectorAll('.detail-gallery-img img, .image-gallery img, .mod-detail-gallery img, img[data-src]');
  result.images = Array.from(imgEls)
    .map(img => img.src || img.getAttribute('data-src'))
    .filter(url => url && !url.includes('blank.gif'));

  // Extra
  result.extra = {
    product_id: parseProductId(),
    price_range_text: parsePriceRange(priceEl?.textContent || ''),
    min_order: parseMinOrder(),
    supplier_name: parseSupplierName(),
    shop_url: parseShopUrl(),
    supplier_rating: parseSupplierRating(),
    supplier_location: parseSupplierLocation(),
    category_path: parse1688Category(),
    moq: parseMinOrder(),
    free_shipping: parseFreeShipping(),
    specs: parseSpecs(),
  };

  return normalizeProduct(result);
}

function parseProductId() {
  const match = window.location.href.match(/offer\/(\d+)\.html/i);
  return match ? match[1] : undefined;
}

function parsePriceRange(text) {
  const values = String(text || '').match(/\d[\d,.]*(?:\.\d+)?/g);
  if (!values || values.length === 0) return undefined;
  if (values.length === 1) return values[0].replace(/,/g, '');
  return `${values[0].replace(/,/g, '')}-${values[1].replace(/,/g, '')}`;
}

function parseMinOrder() {
  const el = document.querySelector('.mod-detail-start-quantity, .minimum-order-quantity');
  if (!el) return undefined;
  const match = el.textContent.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

function parseSupplierName() {
  const el = document.querySelector('.company-name, .supplier-name, .shop-name');
  return el?.textContent?.trim() || undefined;
}

function parseShopUrl() {
  const el = document.querySelector('a[href*="shop.1688.com"], a[href*="winport"], .company-name a, .supplier-name a');
  return el?.href || undefined;
}

function parseSupplierRating() {
  const el = document.querySelector('.supplier-rating, [class*="supplier-rating"], [class*="supplier-level"]');
  return el?.textContent?.trim() || undefined;
}

function parseSupplierLocation() {
  const el = document.querySelector('.company-address, .supplier-location, .location-text');
  return el?.textContent?.trim() || undefined;
}

function parse1688Category() {
  const breadcrumbs = document.querySelectorAll('.breadcrumb a, .crumbs .crumb-item');
  return Array.from(breadcrumbs).map(el => el.textContent.trim()).join(' > ') || undefined;
}

function parseFreeShipping() {
  const el = document.querySelector('.freight-text, .shipping-info');
  return el?.textContent?.includes('免运费') || el?.textContent?.includes('包邮') || undefined;
}

function parseSpecs() {
  const specs = {};
  const rows = document.querySelectorAll('.offer-attr-item, .mod-detail-attributes tr, [class*="attribute"]');
  rows.forEach(row => {
    const text = row.textContent?.trim() || '';
    const match = text.match(/^([^：:]{1,20})[：:]\s*(.{1,80})$/);
    if (!match) return;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!key || !value) return;
    if (/材质|material/i.test(key)) specs.material = value;
    else if (/重量|weight/i.test(key)) specs.weight = value;
    else specs[key] = value;
  });
  return Object.keys(specs).length ? specs : undefined;
}
