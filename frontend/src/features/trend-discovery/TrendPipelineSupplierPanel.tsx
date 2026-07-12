import { ExternalLink, Globe, Package, Search } from "lucide-react"
import type { SupplierForm } from "./TrendPipelineUtils"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"

export function PipelineSupplierPanel({
  item,
  itemSuppliers,
  evidence,
  addingSupplier,
  supForm,
  setSupForm,
  searching1688For,
  eightyEightResults,
  loading1688,
  onOpenPurchase,
  onSearch1688,
  onSubmitSupplier,
  onStartAddSupplier,
  onCancelAddSupplier,
}: any) {
  return (
    <div className="space-y-2">
      <SupplierHint />
      <EvidenceBanner evidence={evidence} compact />
      <SupplierList item={item} itemSuppliers={itemSuppliers} onOpenPurchase={onOpenPurchase} />
      {searching1688For === item.id && eightyEightResults && (
        <SearchResults results={eightyEightResults} loading={loading1688} />
      )}
      <div className="flex gap-2 mb-2">
        <button onClick={() => onSearch1688(item)} disabled={loading1688}
          className="flex-1 text-[11px] text-[var(--color-warning)] bg-[var(--color-warning-light)] border border-dashed border-[var(--color-warning)] rounded-lg py-1.5 text-center hover:bg-[var(--color-warning-light)] transition-colors disabled:opacity-40">
          <Search className="w-3 h-3 inline mr-1" />
          1688 搜索供应商
        </button>
      </div>
      {addingSupplier === item.id ? (
        <SupplierFormPanel
          supForm={supForm}
          setSupForm={setSupForm}
          eightyEightResults={eightyEightResults}
          onSubmit={() => onSubmitSupplier(item.id)}
          onCancel={onCancelAddSupplier}
        />
      ) : (
        <button onClick={() => onStartAddSupplier(item.id)}
          className="text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary)] border border-dashed border-[var(--color-primary)] rounded-lg py-1.5 w-full text-center">
          + 手动添加供应商信息
        </button>
      )}
    </div>
  )
}

function SupplierHint() {
  return (
    <div className="flex items-center gap-1.5 mb-2 px-1">
      <Globe className="w-3 h-3 text-[var(--color-warning)]" />
      <span className="text-[11px] text-[var(--color-warning)]">
        供应商匹配需要在国内网络环境下访问 1688.com
      </span>
      <a href="https://www.1688.com/" target="_blank" rel="noopener noreferrer"
        className="text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary)] ml-auto flex items-center gap-0.5">
        <ExternalLink className="w-2.5 h-2.5" /> 打开 1688
      </a>
    </div>
  )
}

function SupplierList({ item, itemSuppliers, onOpenPurchase }: any) {
  if (itemSuppliers.length === 0) return null
  return (
    <div className="space-y-2 mb-2">
      <p className="text-[11px] font-medium text-[var(--color-muted)]">供应商 ({itemSuppliers.length})</p>
      {itemSuppliers.map((supplier: any) => (
        <div key={supplier.id} className="flex items-center gap-2 bg-[var(--color-bg)] rounded-lg p-2">
          <div className="w-10 h-10 rounded bg-[var(--color-border)] flex items-center justify-center text-lg shrink-0 overflow-hidden">
            {supplier.product_image ? <img src={supplier.product_image} alt={supplier.supplier_name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-[var(--color-muted)]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium text-[var(--color-fg)] truncate">{supplier.supplier_name}</p>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted)]">
              <span>{supplier.purchase_price_rmb != null ? `¥${supplier.purchase_price_rmb}` : '--'}</span>
              <span>MOQ {supplier.moq ?? '--'}</span>
              <span>评级 {supplier.rating ?? '待录入'}</span>
              {supplier.supplier_url && (
                <a href={supplier.supplier_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:text-[var(--color-primary)] ml-auto">链接</a>
              )}
              <button onClick={() => onOpenPurchase(item, supplier)}
                className="text-[var(--color-success)] hover:text-[var(--color-success)]">采购入账</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SearchResults({ results, loading }: any) {
  return (
    <div className="bg-[var(--color-warning-light)] rounded-lg p-2.5 mb-2 space-y-1.5">
      <p className="text-[11px] font-medium text-[var(--color-warning)] flex items-center gap-1">
        <Search className="w-3 h-3" /> 1688 供应商搜索建议
        <span className="text-[11px] text-[var(--color-warning)] font-normal ml-1">（点击链接在 1688 打开搜索结果）</span>
      </p>
      {loading ? (
        <div className="text-[11px] text-[var(--color-warning)] animate-pulse">搜索中...</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {results.suggestions?.map((item: any, index: number) => (
            <a key={index} href={item.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-surface)] rounded text-[11px] text-[var(--color-fg)] border border-[var(--color-warning)] hover:border-[var(--color-warning)] hover:bg-[var(--color-warning-light)] transition-colors">
              <Search className="w-2.5 h-2.5 text-[var(--color-warning)]" />
              {item.label}
              <ExternalLink className="w-2.5 h-2.5 text-[var(--color-muted)]" />
            </a>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[var(--color-warning)] mt-1">{results.note}</p>
    </div>
  )
}

function SupplierFormPanel({ supForm, setSupForm, eightyEightResults, onSubmit, onCancel }: {
  supForm: SupplierForm
  setSupForm: (value: SupplierForm | ((prev: SupplierForm) => SupplierForm)) => void
  eightyEightResults: any
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="bg-[var(--color-primary-light)] rounded-lg p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <input className="flex-1 text-xs border border-[var(--color-primary)] rounded px-2 py-1" placeholder="供应商名称 *"
          value={supForm.supplier_name} onChange={e => setSupForm({...supForm, supplier_name: e.target.value})} />
        {eightyEightResults?.suggestions?.[0] && (
          <button onClick={() => {
            const suggestion = eightyEightResults.suggestions[0]
            setSupForm(prev => ({ ...prev, supplier_url: suggestion.url }))
          }}
            className="text-[11px] text-[var(--color-primary)] whitespace-nowrap">填入1688链接</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="text-xs border border-[var(--color-primary)] rounded px-2 py-1" type="number" placeholder="采购价 (RMB)"
          value={supForm.purchase_price_rmb} onChange={e => setSupForm({...supForm, purchase_price_rmb: e.target.value})} />
        <input className="text-xs border border-[var(--color-primary)] rounded px-2 py-1" placeholder="商品链接/1688链接"
          value={supForm.supplier_url} onChange={e => setSupForm({...supForm, supplier_url: e.target.value})} />
      </div>
      <input className="w-full text-xs border border-[var(--color-primary)] rounded px-2 py-1" placeholder="产品图片链接（可选）"
        value={supForm.product_image} onChange={e => setSupForm({...supForm, product_image: e.target.value})} />
      <div className="flex gap-2">
        <button onClick={onSubmit}
          className="text-xs bg-[var(--color-primary)] text-[var(--color-primary-text)] px-3 py-1 rounded hover:bg-[var(--color-primary-hover)]">保存</button>
        <button onClick={onCancel}
          className="text-xs text-[var(--color-muted)] px-2 py-1 hover:text-[var(--color-fg)]">取消</button>
      </div>
    </div>
  )
}
