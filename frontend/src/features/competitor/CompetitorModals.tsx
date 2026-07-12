import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useAddCompetitor, useSetAlertRule } from '../../hooks/useMonitor'
import { useConfig } from '../../hooks/useConfig'

export function AddCompetitorModal({ onClose }: { onClose: () => void }) {
  const add = useAddCompetitor()
  const { platforms, markets } = useConfig()
  const [form, setForm] = useState({ url: '', platform: '', market: '', currency: '', name: '', seller_name: '', price: '' })

  const handleMarketChange = (market: string) => {
    setForm({ ...form, market, currency: markets.find((item) => item.id === market)?.currency || '' })
  }
  const handleSubmit = () => {
    if (!form.url.trim() || !form.platform || !form.market || !form.currency) return
    add.mutate({
      url: form.url.trim(), platform: form.platform, market: form.market, currency: form.currency,
      name: form.name.trim() || undefined, seller_name: form.seller_name.trim() || undefined,
      price: form.price ? Number(form.price) : undefined,
    }, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title="添加竞品" size="sm" footer={<><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)]">取消</button><button onClick={handleSubmit} disabled={add.isPending || !form.url.trim() || !form.platform || !form.market || !form.currency} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-[var(--color-primary-text)] disabled:opacity-50">{add.isPending ? '添加中' : '添加'}</button></>}>
      <div className="space-y-3">
        <Field label="竞品 URL *" value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder="https://..." />
        <SelectField label="平台 *" value={form.platform} onChange={(platform) => setForm({ ...form, platform })} options={platforms} />
        <SelectField label="东南亚市场 *" value={form.market} onChange={handleMarketChange} options={markets} />
        <Field label="币种" value={form.currency} onChange={() => undefined} placeholder="选择市场后由字典确定" disabled />
        <Field label="商品名称" value={form.name} onChange={(name) => setForm({ ...form, name })} placeholder="可选" />
        <Field label="卖家名称" value={form.seller_name} onChange={(seller_name) => setForm({ ...form, seller_name })} placeholder="可选" />
        <Field label="当前价格" value={form.price} onChange={(price) => setForm({ ...form, price })} placeholder="可选" type="number" />
        <p className="text-[11px] text-[var(--color-muted)]">采集方式：商家 URL 手工录入；可信度：待平台或第二来源复核。</p>
      </div>
    </Modal>
  )
}

export function AlertRuleModal({ competitorId, onClose }: { competitorId: string; onClose: () => void }) {
  const setRule = useSetAlertRule()
  const { competitor_alert_conditions = [] } = useConfig()
  const [form, setForm] = useState({ condition: '', threshold: 10 })
  const submit = () => setRule.mutate({ competitor_id: competitorId, ...form }, { onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title="设置预警规则" size="sm" footer={<><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)]">取消</button><button onClick={submit} disabled={setRule.isPending} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-[var(--color-primary-text)] disabled:opacity-50">{setRule.isPending ? '保存中' : '保存'}</button></>}>
      <div className="space-y-3">
        <SelectField label="预警条件" value={form.condition} onChange={(condition) => setForm({ ...form, condition })} options={competitor_alert_conditions} />
        <Field label="阈值" value={String(form.threshold)} type="number" onChange={(value) => setForm({ ...form, threshold: Number(value) })} />
      </div>
    </Modal>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return <label className="block text-xs text-[var(--color-muted)]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} disabled={disabled} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] disabled:opacity-60" /></label>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; label: string }[] }) {
  return <label className="block text-xs text-[var(--color-muted)]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]"><option value="">请选择</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
}
