import { DollarSign, Package, Sparkles, Trash2, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import type { ProductClassData } from '../../api/products'
import { labelBusinessCode } from '../../utils/businessLabels'

const CLASS_CONFIG: Record<string, { label: string; accent: string; icon: React.ReactNode }> = {
  core: { label: '核心款', accent: 'var(--color-success)', icon: <Sparkles className="w-3.5 h-3.5" /> },
  profit: { label: '利润款', accent: 'var(--color-accent)', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  traffic: { label: '引流款', accent: 'var(--color-warning)', icon: <DollarSign className="w-3.5 h-3.5" /> },
  new: { label: '新品', accent: 'var(--color-info)', icon: <Package className="w-3.5 h-3.5" /> },
  dead: { label: '待清理', accent: 'var(--color-danger)', icon: <Trash2 className="w-3.5 h-3.5" /> },
  data_missing: { label: '待补数据', accent: 'var(--color-warning)', icon: <TrendingUp className="w-3.5 h-3.5" /> },
}

export function ProductHealthPanel({ data }: { data: ProductClassData }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="font-semibold text-[var(--color-fg)] flex items-center gap-1.5 text-[15px] mb-5">
          <Package className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          商品健康度
          <span className="text-xs font-normal text-[var(--color-muted)] ml-1">
            共 {data.total_products} 个产品 · 总营收 ¥{data.total_revenue.toFixed(0)}
          </span>
        </h2>
        {data.revenue_status === 'partial' && (
          <p className="text-xs mb-3 text-[var(--color-warning)]">
            {data.missing_metric_count} 个在售商品缺销量、售价或利润率，营收汇总仅包含数据完整商品。
          </p>
        )}
        <div className="mb-3 rounded-md bg-[var(--color-bg)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
          数据范围：{data.evidence_window} · 数据来源 {data.source_refs.length} 条
          {data.data_gaps.length > 0 && <span className="ml-2 text-[var(--color-warning)]">{data.data_gaps.map(labelBusinessCode).join('；')}</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(CLASS_CONFIG).map(([key, config]) => {
            const distribution = data.distribution[key]
            if (!distribution) return null
            const percentage = data.total_products > 0 ? distribution.count / data.total_products * 100 : 0
            return (
              <div key={key} className="rounded-xl p-4 text-center border" style={{
                background: `color-mix(in oklch, ${config.accent} 8%, var(--color-surface))`,
                borderColor: `color-mix(in oklch, ${config.accent} 20%, var(--color-border))`,
              }}>
                <div className="flex items-center justify-center gap-1 mb-1.5" style={{ color: config.accent }}>
                  {config.icon}
                  <span className="text-xs font-medium">{config.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: config.accent }}>{distribution.count}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{percentage.toFixed(0)}%</p>
                {distribution.revenue_share > 0 && (
                  <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>营收占 {distribution.revenue_share}%</p>
                )}
              </div>
            )
          })}
        </div>

        {data.core_products.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-muted)' }}>
              核心款（{data.distribution.core?.count || 0}个产品贡献{data.distribution.core?.revenue_share || 0}%已知营收）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {data.core_products.slice(0, 3).map((product, index) => (
                <div key={index} className="rounded-lg px-3 py-2 text-xs border" style={{
                  background: 'color-mix(in oklch, var(--color-success) 6%, var(--color-surface))',
                  borderColor: 'color-mix(in oklch, var(--color-success) 15%, var(--color-border))',
                }}>
                  <p className="font-medium truncate" style={{ color: 'var(--color-fg)' }}>{product.name}</p>
                  <p className="mt-0.5" style={{ color: 'var(--color-muted)' }}>
                    {product.orders ?? '--'}单 · {product.revenue == null ? '营收待补' : `¥${product.revenue.toFixed(0)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
