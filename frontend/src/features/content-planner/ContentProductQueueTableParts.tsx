import { CheckCircle2, DollarSign, Edit3, FileText, Image, Megaphone } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { PlatformFieldGroupSummary } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'
import { QueueCheckbox } from './ContentProductQueueParts'
import { STATUS_LABELS, hasAttributeValue, objectRefContextLabel, productIdForAction, storeContextLabel, workflowUrl } from './ContentProductQueueUtils'

export function ContentProductSellerTable({
  allVisibleChecked,
  checkedIds,
  items,
  onOpenListing,
  onOpenMediaWorkbench,
  onOpenRow,
  onToggleRow,
  onToggleVisible,
  partiallyChecked,
  selectedId,
}: {
  allVisibleChecked: boolean
  checkedIds: string[]
  items: ContentWorkbenchItem[]
  onOpenListing?: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
  onOpenRow: (item: ContentWorkbenchItem) => void
  onToggleRow: (id: string) => void
  onToggleVisible: () => void
  partiallyChecked: boolean
  selectedId: string
}) {
  return (
    <div className="content-product-table" style={{ scrollbarWidth: 'thin' }} data-ui="content-product-seller-console-table">
      <table>
        <thead>
          <tr>
            <th className="w-10">
              <QueueCheckbox checked={allVisibleChecked} indeterminate={partiallyChecked} onChange={onToggleVisible} ariaLabel="选择当前页全部商品" />
            </th>
            <th>商品信息</th>
            <th>平台 / 店铺 / 市场</th>
            <th>内容状态</th>
            <th>发布图 / 视频</th>
            <th>标题 / 描述</th>
            <th>SKU / 属性</th>
            <th>价格 / 库存</th>
            <th>待处理缺口</th>
            <th className="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ContentProductSellerRow
              key={item.work_item_id}
              checked={checkedIds.includes(item.work_item_id)}
              item={item}
              onOpenListing={onOpenListing}
              onOpenMediaWorkbench={onOpenMediaWorkbench}
              onOpenRow={onOpenRow}
              onToggleRow={onToggleRow}
              selected={item.work_item_id === selectedId}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContentProductSellerRow({
  checked,
  item,
  onOpenListing,
  onOpenMediaWorkbench,
  onOpenRow,
  onToggleRow,
  selected,
}: {
  checked: boolean
  item: ContentWorkbenchItem
  onOpenListing?: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
  onOpenRow: (item: ContentWorkbenchItem) => void
  onToggleRow: (id: string) => void
  selected: boolean
}) {
  const brief = item.content_brief?.bullets || []
  const mediaReadiness = item.media_readiness
  const mediaGaps = mediaReadiness?.gaps || []
  const requiredAttributes = item.platform_requirements?.required_attributes || []
  const attributeValues = item.platform_requirements?.attribute_values || {}
  const filledAttributes = requiredAttributes.filter(field => hasAttributeValue(attributeValues, field)).length
  const productId = productIdForAction(item)
  const pricingUrl = workflowUrl('/pricing', item)
  const publishUrl = workflowUrl('/publish', item)

  return (
    <tr onClick={() => onOpenRow(item)} className={selected ? 'content-product-row content-product-row-active' : 'content-product-row'}>
      <td>
        <span onClick={event => event.stopPropagation()}>
          <QueueCheckbox checked={checked} onChange={() => onToggleRow(item.work_item_id)} ariaLabel={`选择商品 ${item.product_name}`} />
        </span>
      </td>
      <td>
        <div className="content-product-info-cell">
          {item.image_url ? (
            <img src={productImageSrc(item.image_url)} alt={item.product_name} />
          ) : (
            <div className="content-product-image-missing">缺主图</div>
          )}
          <div>
            <p className="content-product-name">{item.product_name}</p>
            <p>资料 {item.evidence_summary.present}/{item.evidence_summary.total}</p>
            <p>ID：{productId}</p>
          </div>
        </div>
      </td>
      <td data-ui="content-product-store-context-summary">
        <p className="content-product-strong-text">{item.target_platform || '--'}</p>
        <p>{storeContextLabel(item)}</p>
        <p>市场：{item.target_market || '--'}</p>
        <p>{objectRefContextLabel(item)}</p>
      </td>
      <td>
        <div className="content-product-status-line">
          {item.content_status === 'ready'
            ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            : <FileText className="h-4 w-4 text-[var(--color-warning)]" />}
          <span>{STATUS_LABELS[item.content_status] || item.content_status}</span>
        </div>
        <p>{item.lifecycle_label}</p>
      </td>
      <td>
        <p className={mediaReadiness && (mediaReadiness.captured_image_count ?? 0) >= (mediaReadiness.min_platform_images ?? 5) ? 'content-product-success-text' : 'content-product-warning-text'}>
          发布图 {mediaReadiness?.captured_image_count ?? 0}/{mediaReadiness?.min_platform_images ?? 5}
        </p>
        <p>推荐 {mediaReadiness?.recommended_platform_images ?? 9} 张 · 主图/辅图/SKU图</p>
        <p>视频：{item.content_brief?.video_script ? '已有脚本' : '待生成/可选'}</p>
      </td>
      <td>
        <p className="content-product-copy-title">{item.content_brief?.title || item.product_name}</p>
        <p>卖点摘要 {brief.length} 项 · 描述 {brief.join('').length} 字</p>
      </td>
      <td className="content-product-attribute-cell">
        <PlatformFieldGroupSummary requirements={item.platform_requirements} compact maxGroups={1} />
        <p className={requiredAttributes.length > 0 && filledAttributes >= requiredAttributes.length ? 'content-product-success-text' : 'content-product-warning-text'}>
          平台属性 {filledAttributes}/{requiredAttributes.length || 0}
        </p>
        <p>SKU/变体：进入 Listing 编辑页维护组合、价格、库存和SKU图</p>
      </td>
      <td>
        <p className="content-product-strong-text">{item.selling_price_local != null ? item.selling_price_local : '待定价'}</p>
        <p>采购 {item.source_price_rmb != null ? `¥${item.source_price_rmb}` : '待补'} · 利润 {item.profit_margin_pct != null ? `${item.profit_margin_pct}%` : '待校验'}</p>
        <p>库存：发布/同步后回写</p>
      </td>
      <td>
        {[...item.content_gaps, ...mediaGaps].length > 0
          ? <p className="content-product-gap-text">{[...item.content_gaps, ...mediaGaps].slice(0, 5).join('、')}</p>
          : <span className="content-product-success-text">无阻断缺口</span>}
      </td>
      <td>
        <div className="content-product-row-action-set" data-ui="content-product-row-action-set">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenRow(item)
              onOpenListing?.(item)
            }}
            className="content-product-action content-product-action-primary"
          >
            <Edit3 className="mr-1 h-3 w-3" />
            编辑 Listing
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenRow(item)
              onOpenMediaWorkbench?.(item)
            }}
            className="content-product-action"
          >
            <Image className="mr-1 h-3 w-3" />
            处理图片
          </button>
          <a href={pricingUrl} onClick={event => event.stopPropagation()} className="content-product-action">
            <DollarSign className="mr-1 h-3 w-3" />
            定价
          </a>
          <a href={publishUrl} onClick={event => event.stopPropagation()} className="content-product-action">
            <Megaphone className="mr-1 h-3 w-3" />
            刊登
          </a>
        </div>
      </td>
    </tr>
  )
}
