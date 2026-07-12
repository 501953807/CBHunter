/**
 * Shopee product parser.
 * Works on: shopee.com.my, shopee.ph, shopee.sg, shopee.co.th, shopee.vn, shopee.tw, shopee.co.id
 */
import { normalizeProduct, sendToBackend } from './base.js';

export async function parseShopeeProduct() {
  const result = { source_platform: 'shopee' };

  // Extract from URL
  result.source_url = window.location.href;

  // Title
  const titleEl = document.querySelector('div[data-testid="product-title"], .product-title, h1');
  result.title = titleEl?.textContent?.trim() || '';

  // Price
  const priceEl = document.querySelector('div[data-testid="price"], .product-price, .price');
  const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, '') || '';
  const parsedPrice = parseFloat(priceText);
  result.price = Number.isFinite(parsedPrice) ? parsedPrice : undefined;

  // Currency - infer from domain
  const host = window.location.hostname;
  if (host.includes('com.my')) result.currency = 'MYR';
  else if (host.includes('.ph')) result.currency = 'PHP';
  else if (host.includes('.sg')) result.currency = 'SGD';
  else if (host.includes('.co.th')) result.currency = 'THB';
  else if (host.includes('.vn')) result.currency = 'VND';
  else if (host.includes('.tw')) result.currency = 'TWD';
  else if (host.includes('.co.id')) result.currency = 'IDR';

  // Images
  const imgEls = document.querySelectorAll('.product-image img, .image-gallery img, img[data-testid="product-image"]');
  result.images = Array.from(imgEls).map(img => img.src).filter(Boolean);

  // Shop info
  const shopEl = document.querySelector('.shop-name, [data-testid="shop-name"]');
  result.extra = {
    shop_id: shopEl?.textContent?.trim() || '',
    voucher_price: parseVoucherPrice(),
    sales: parseSales(),
    rating: parseRating(),
    category_path: parseCategoryPath(),
  };

  return normalizeProduct(result);
}

function parseVoucherPrice() {
  const el = document.querySelector('.voucher-price, [data-testid="voucher-price"]');
  return el ? parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || undefined : undefined;
}

function parseSales() {
  const el = document.querySelector('.product-sales, [data-testid="sales-count"]');
  if (!el) return undefined;
  const match = el.textContent.match(/([\d,.]+)/);
  return match ? parseInt(match[1].replace(/[,.]/g, '')) : undefined;
}

function parseRating() {
  const el = document.querySelector('.shopee-rating-stars, [data-testid="rating-stars"]');
  if (!el) return undefined;
  const match = el.getAttribute('aria-label')?.match(/([\d.]+)/) || el.textContent?.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : undefined;
}

function parseCategoryPath() {
  const breadcrumbs = document.querySelectorAll('.breadcrumb-item, [data-testid="breadcrumb"] span');
  return Array.from(breadcrumbs).map(el => el.textContent.trim()).join(' > ') || undefined;
}
