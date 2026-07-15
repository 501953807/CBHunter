import { ArrowRight, Boxes, GitBranch, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import type { ContentWorkbenchItem } from '../../api/content'

interface Props {
  product: ContentWorkbenchItem | null
  storeLabel: string
  onNavigate: (path: string) => void
}

export function ListingObjectScopeMap({ product, storeLabel, onNavigate }: Props) {
  const productId = product?.object_refs?.find(ref => ref.type === 'product')?.id
  const pricingRoute = product ? `/pricing?content_item_id=${product.id}` : '/pricing'
  const publishRoute = productId ? `/publish?product_id=${productId}` : '/publish'
  const baseLabel = product ? product.product_name : '未选择基础商品'
  const instanceLabel = storeLabel || `${product?.target_platform || '平台待补'} · 店铺待选择`
  const overrideFields = [
    '标题',
    '主图/辅图',
    '价格',
    'SKU/变体',
    '平台属性',
    '物流包装',
    '合规资料',
  ]

  return (
    <section
      aria-label="基础商品与店铺 Listing 实例关系"
      data-ui="listing-object-scope-map"
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">Listing 对象关系</p>
            <h2 className="mt-1 text-base font-semibold text-[var(--color-fg)]">基础商品 → 店铺 Listing 实例 → 定价发布</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-muted)]">
              一个基础商品可以发布到多个平台和店铺；当前店铺实例的标题、图片、价格、SKU、属性、物流和合规字段可以独立覆盖，不回写污染基础商品版本。
            </p>
          </div>
          <Badge variant={product ? 'success' : 'warning'}>{product ? '对象已锁定' : '先选择商品'}</Badge>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.8fr)]">
        <ScopeNode
          icon={<Boxes className="h-4 w-4" />}
          title="基础商品版本"
          value={baseLabel}
          detail={product ? `内容队列 ${product.id} · ${product.category || '类目待补'}` : '从左侧内容商品队列选择后锁定。'}
          status={product ? product.lifecycle_label : '未锁定'}
        />
        <ScopeNode
          icon={<Store className="h-4 w-4" />}
          title="当前店铺 Listing 实例"
          value={instanceLabel}
          detail={`${product?.target_platform || '平台待补'} / ${product?.target_market || '市场待补'} · 店铺字段可独立覆盖`}
          status={storeLabel ? '店铺已选择' : '店铺待选择'}
        />
        <div className="border-t border-[var(--color-border)] p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
            <GitBranch className="h-4 w-4 text-[var(--color-primary)]" />
            店铺覆盖字段
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {overrideFields.map(field => (
              <span key={field} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
                {field}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Button size="sm" onClick={() => onNavigate(pricingRoute)} disabled={!product}>
              进入定价校验 <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate(publishRoute)} disabled={!product}>
              进入平台刊登
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ScopeNode({ icon, title, value, detail, status }: {
  icon: ReactNode
  title: string
  value: string
  detail: string
  status: string
}) {
  return (
    <div className="border-t border-[var(--color-border)] p-4 lg:border-t-0 lg:border-r">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">{icon}</span>
          {title}
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{status}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}
