import { useEffect, useState } from 'react'
import { Calculator, DollarSign } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { calculateProfit, listPlatforms } from '../../api/profitability'
import { useConfig } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'
import type { FullProfitAnalysis, PlatformMarket } from '../../types/profitability'

export function ProfitabilityTab() {
  const { platforms: configPlatforms } = useConfig()
  const [platforms, setPlatforms] = useState<PlatformMarket[]>([])
  const [form, setForm] = useState({ purchase_cost_rmb: '', weight_g: '', platform: '', market: '', shipping_cost_rmb: '', markup_pct: '' })
  const [result, setResult] = useState<FullProfitAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listPlatforms().then((response) => {
      if (response.data) setPlatforms(response.data as PlatformMarket[])
    }).catch((loadError) => logger.error('Load profitability platforms failed', loadError))
  }, [])

  const platformOptions = configPlatforms
    .filter((platform) => platforms.some((item) => item.platform === platform.id))
    .map((platform) => ({ value: platform.id, label: platform.label }))
  const filteredPlatforms = platforms.filter((platform) => platform.platform === form.platform)

  const doCalculate = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await calculateProfit({
        purchase_cost_rmb: Number(form.purchase_cost_rmb),
        weight_g: Number(form.weight_g),
        platform: form.platform,
        market: form.market,
        shipping_cost_rmb: Number(form.shipping_cost_rmb) > 0 ? Number(form.shipping_cost_rmb) : undefined,
        markup_pct: Number(form.markup_pct),
      })
      if (response.data?.status && response.data.status !== 'ready') {
        setResult(null)
        setError(response.data.note || '缺少真实费率、汇率或运费配置')
      } else if (response.data) {
        setResult(response.data as FullProfitAnalysis)
      }
    } catch (calculationError) {
      logger.error('Profitability calculation failed', calculationError)
      setError('计算失败，请检查参数')
    }
    setLoading(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card><CardContent className="pt-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-1"><Calculator className="w-4 h-4" />输入参数</h3>
        <Input label="1688采购价 (RMB)" type="number" value={form.purchase_cost_rmb} onChange={(event) => setForm({ ...form, purchase_cost_rmb: event.target.value })} />
        <Input label="重量 (克)" type="number" value={form.weight_g} onChange={(event) => setForm({ ...form, weight_g: event.target.value })} />
        <Input label="实际运费 RMB" type="number" value={form.shipping_cost_rmb} onChange={(event) => setForm({ ...form, shipping_cost_rmb: event.target.value })} />
        <Input label="目标加价率 (%)" type="number" value={form.markup_pct} onChange={(event) => setForm({ ...form, markup_pct: event.target.value })} />
        <Select label="目标平台" options={platformOptions} value={form.platform} onChange={(value) => setForm({ ...form, platform: value, market: '' })} />
        <Select label="目标市场" options={filteredPlatforms.map((platform) => ({ value: platform.market, label: platform.label.split(' - ')[1] || platform.market }))}
          value={form.market} onChange={(value) => setForm({ ...form, market: value })} />
        <Button className="w-full" onClick={doCalculate}
          disabled={loading || !form.market || Number(form.purchase_cost_rmb) <= 0 || Number(form.weight_g) <= 0 || Number(form.shipping_cost_rmb) <= 0 || Number(form.markup_pct) <= 0}>
          {loading ? '计算中...' : '计算利润'}
        </Button>
      </CardContent></Card>

      <div className="lg:col-span-2">
        {error && <Card><CardContent className="pt-4"><p className="text-sm text-[var(--color-danger)]">{error}</p></CardContent></Card>}
        {result ? (
          <div className="space-y-4">
            <Card><CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3 flex items-center gap-1"><DollarSign className="w-4 h-4" />成本分析 - {result.platform_display} {result.market_display}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['采购成本', `¥${result.purchase_cost_rmb.toFixed(2)}`],
                  ['实际运费', `¥${result.shipping_cost_rmb.toFixed(2)}`],
                  ['佣金率', `${(result.commission_rate * 100).toFixed(0)}%`],
                  ['货币', result.currency],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[var(--color-bg)] rounded-lg p-3 text-center">
                    <p className="text-xs text-[var(--color-muted)]">{label}</p>
                    <p className="text-lg font-bold text-[var(--color-fg)]">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3">定价方案</h3>
              <div className="space-y-2">
                {result.scenarios.map((scenario, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 p-3 border border-[var(--color-border)] rounded-lg text-sm">
                    <span>{scenario.selling_price_local.toFixed(2)} {result.currency}</span>
                    <span>平台费 ¥{scenario.platform_fee_rmb.toFixed(2)}</span>
                    <span>净利润 ¥{scenario.net_profit_rmb.toFixed(2)}</span>
                    <Badge variant={scenario.profit_margin_pct >= 30 ? 'success' : scenario.profit_margin_pct >= 15 ? 'warning' : 'danger'}>
                      {scenario.profit_margin_pct.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        ) : !error && (
          <Card><CardContent className="pt-4"><div className="text-center py-12 text-[var(--color-muted)]">
            <Calculator className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">录入真实采购、重量、运费和目标市场后计算利润</p>
          </div></CardContent></Card>
        )}
      </div>
    </div>
  )
}
