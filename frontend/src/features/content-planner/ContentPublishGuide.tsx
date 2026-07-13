import { ArrowRight, CheckCircle2, FileText, Tags } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import type { ContentWorkbenchItem } from '../../api/content'
import { BusinessObjectActionBar } from '../../components/shared/BusinessObjectActionBar'
import { productImageSrc } from '../../utils/productImages'

export function ContentPublishGuide({ product }: { product: ContentWorkbenchItem | null }) {
  const navigate = useNavigate()
  const attrs = product?.platform_requirements?.required_attributes || []
  const media = product?.platform_requirements?.media || []
  const pricingRoute = product ? `/pricing?content_item_id=${product.id}` : '/pricing'
  const publishRoute = product?.object_refs?.find(ref => ref.type === 'product')?.id
    ? `/publish?product_id=${product.object_refs.find(ref => ref.type === 'product')?.id}`
    : '/publish'
  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="font-semibold text-[var(--color-fg)]">进入平台刊登</h3>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          内容工厂不再手填 Shopee CSV。商品必须先完成内容任务人工确认，再进入定价校验，最后在批量刊登中创建本地 Listing 草稿。
        </p>
        {product ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="内容到刊登商品上下文">
            <div className="flex items-center gap-3">
              {product.image_url && <img src={productImageSrc(product.image_url)} alt={product.product_name} className="h-14 w-14 rounded-lg object-cover" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{product.product_name}</p>
                <p className="text-xs text-[var(--color-muted)]">{product.target_platform || '平台待补'} / {product.target_market || '市场待补'} · {product.lifecycle_label}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...attrs, ...media].slice(0, 8).map(item => (
                <span key={item} className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">请先在上方内容商品队列选择商品。</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['内容确认', '定价校验', '平台刊登'].map((step, index) => (
            <div key={step} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
                {index === 0 ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" /> : <Tags className="w-4 h-4 text-[var(--color-primary)]" />}
                {step}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {index === 0 ? '任务矩阵人工确认' : index === 1 ? '成本、费率、汇率和竞品价格带' : '三平台本地 Listing 草稿与发布计划'}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(pricingRoute)} disabled={!product}>
            进入定价校验 <ArrowRight className="ml-1 w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={() => navigate(publishRoute)}>
            打开批量刊登
          </Button>
        </div>
        <BusinessObjectActionBar
          description="从当前内容商品继续下钻，带入当前商品，不再跳到孤立页面重新选择对象。"
          actions={[
            { label: '回到任务矩阵', description: '确认标题、卖点、图片、视频和合规任务。', href: '/content' },
            { label: '进入定价校验', description: '使用当前商品成本、平台和市场计算售价。', onClick: () => navigate(pricingRoute), disabled: !product },
            { label: '进入批量刊登', description: '价格确认后创建本地 Listing 草稿。', onClick: () => navigate(publishRoute) },
          ]}
        />
      </CardContent>
    </Card>
  )
}
