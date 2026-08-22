import type { ContentWorkbenchItem } from '../../api/content'
import { type BulkActionKind, STATUS_LABELS, workflowUrl } from './ContentProductQueueUtils'

export function BulkActionWorkbench({
  action,
  items,
  onClose,
  onOpenListing,
  onOpenMediaWorkbench,
}: {
  action: BulkActionKind
  items: ContentWorkbenchItem[]
  onClose: () => void
  onOpenListing: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
}) {
  const meta = bulkActionMeta(action)
  return (
    <section
      aria-label="内容商品批量处理队列"
      data-ui="content-product-bulk-action-workbench"
      className="content-product-bulk-action-workbench"
    >
      <div className="content-product-bulk-workbench-header">
        <div>
          <p>{meta.title}</p>
          <span>{meta.description}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="content-product-secondary-action"
        >
          收起队列
        </button>
      </div>
      <div className="content-product-bulk-table-shell">
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>平台/市场</th>
              <th>当前缺口</th>
              <th className="text-right">处理动作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={`${action}-${item.work_item_id}`}>
                <td>
                  <p>{item.product_name}</p>
                  <span>状态：{STATUS_LABELS[item.content_status] || item.content_status}</span>
                </td>
                <td>
                  <p>{item.target_platform || '--'}</p>
                  <span>{item.target_market || '--'}</span>
                </td>
                <td className="content-product-warning-text">
                  {bulkActionGaps(action, item).join('、') || '未发现该类阻断缺口，可进入人工复核'}
                </td>
                <td>
                  <div className="content-product-bulk-row-actions">
                    {action === 'media' && onOpenMediaWorkbench ? (
                      <button
                        type="button"
                        onClick={() => onOpenMediaWorkbench(item)}
                        className="content-product-primary-outline-action"
                      >
                        处理图片
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenListing(item)}
                        className="content-product-primary-outline-action"
                      >
                        打开 Listing
                      </button>
                    )}
                    {action === 'pricing' && (
                      <a
                        href={workflowUrl('/pricing', item)}
                        className="content-product-secondary-action"
                      >
                        定价页
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="content-product-bulk-boundary-note">
        该队列只组织本地处理入口，不声明已批量生成、已完成素材校验或已完成定价；实际写入仍在 Listing、图片或定价页面人工确认后发生。
      </p>
    </section>
  )
}

function bulkActionMeta(action: BulkActionKind) {
  if (action === 'copy') {
    return {
      title: '批量文案处理队列',
      description: '把已选商品集中为文案处理清单，逐个进入 Listing 编辑区生成或确认标题、描述和卖点。',
    }
  }
  if (action === 'media') {
    return {
      title: '批量素材校验队列',
      description: '把已选商品集中为发布图/视频处理清单，逐个进入图片工作台补图、排序、设主图或处理发布图缺口。',
    }
  }
  return {
    title: '批量定价校验队列',
    description: '把已选商品集中为价格处理清单，逐个进入定价页或 Listing 价格区核对成本、售价和利润缺口。',
  }
}

function bulkActionGaps(action: BulkActionKind, item: ContentWorkbenchItem) {
  if (action === 'media') return item.media_readiness?.gaps || []
  if (action === 'pricing') {
    return [
      item.selling_price_local == null ? '售价待定价' : '',
      item.profit_margin_pct == null ? '利润待校验' : '',
      item.source_price_rmb == null ? '采购成本待补' : '',
    ].filter(Boolean)
  }
  return item.content_gaps.length > 0 ? item.content_gaps : ['标题/描述/卖点需人工复核']
}
