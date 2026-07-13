import { Package, Plus, RefreshCw, ShoppingCart, Trash2, TrendingUp } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { productImageSrc } from "../../utils/productImages"

export function PillFilter({ title, allLabel, value, options, tone, onChange }: any) {
  const activeBg = tone === 'success' ? 'var(--color-success)' : 'var(--color-primary)'
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] text-[var(--color-muted)] font-medium">{title}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <PillButton active={value === ''} activeBg={activeBg} onClick={() => onChange('')}>{allLabel}</PillButton>
          {options.map((item: any) => (
            <PillButton key={item.id} active={value === item.id} activeBg={activeBg} onClick={() => onChange(item.id)}>
              {item.flag ? `${item.flag} ` : ''}
              {tone === 'primary' && <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold text-[var(--color-primary-text)] bg-[var(--color-primary)]">{item.label?.[0] || item.id?.[0]}</span>}
              {tone === 'primary' ? ` ${item.label}` : item.label}
            </PillButton>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PillButton({ active, activeBg, onClick, children }: any) {
  return (
    <button onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
      style={{
        background: active ? activeBg : 'var(--color-bg)',
        color: active ? 'var(--color-primary-text)' : 'var(--color-muted)',
        boxShadow: active ? 'var(--shadow-sm)' : undefined,
      }}>
      {children}
    </button>
  )
}

export function TrendingToolbar({ count, pageSize, syncMutation, onSync }: any) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-[var(--color-muted)]">
        共 {count} 个热卖商品
        <span className="ml-2 text-[var(--color-muted)]">每页{pageSize}个</span>
      </p>
      <button onClick={onSync} disabled={syncMutation.isPending}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-[var(--color-primary-text)] disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}>
        <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
        自动同步
      </button>
      {syncMutation.isPending && <span className="text-xs text-[var(--color-primary)] animate-pulse">正在同步可用热卖来源...</span>}
      {syncMutation.data?.data && (
        <span className="text-xs text-[var(--color-success)]">
          同步完成：Shopee {syncMutation.data.data.shopee ?? 0} / TEMU {syncMutation.data.data.temu ?? 0} / TikTok Shop {syncMutation.data.data.tiktok ?? 0}
          {(syncMutation.data.data.errors?.length ?? 0) > 0 && <span className="text-[var(--color-danger)] ml-1">({syncMutation.data.data.errors.length} 个错误)</span>}
        </span>
      )}
    </div>
  )
}

export function TrendingProductsGrid({
  isLoading,
  filteredCount,
  pageProducts,
  showAddForm,
  setShowAddForm,
  addName,
  setAddName,
  addForm,
  setAddForm,
  categoryOptions,
  onAdd,
  onDelete,
  onCapture,
}: any) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-36 bg-[var(--color-bg)] rounded-xl animate-pulse" />)}
      </div>
    )
  }
  if (filteredCount === 0 && !showAddForm) {
    return (
      <Card>
        <CardContent className="pt-4 text-center py-10 text-[var(--color-muted)]">
          <TrendingUp className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">暂无热卖商品数据</p>
          <p className="text-xs mt-1">点击「自动同步」从各平台获取热卖数据</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {pageProducts.map((product: any) => <TrendingProductCard key={product.id} product={product} onDelete={onDelete} onCapture={onCapture} />)}
      <ManualAddCard
        showAddForm={showAddForm}
        setShowAddForm={setShowAddForm}
        addName={addName}
        setAddName={setAddName}
        addForm={addForm}
        setAddForm={setAddForm}
        categoryOptions={categoryOptions}
        onAdd={onAdd}
      />
    </div>
  )
}

function TrendingProductCard({ product, onDelete, onCapture }: any) {
  return (
    <div className="group relative rounded-xl border overflow-hidden transition-shadow hover:shadow-md" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <button onClick={() => onDelete(product)}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] hover:bg-[var(--color-danger)] hover:text-[var(--color-primary-text)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
        title="删除">
        <Trash2 className="w-3 h-3" />
      </button>
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        {product.images?.length > 0 ? (
          <img src={productImageSrc(product.images[0])} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"
            onError={(event) => { (event.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 opacity-20" style={{ color: 'var(--color-muted)' }} /></div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--color-fg)', minHeight: '2.5em' }}>{product.name}</h3>
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {product.platform && <span className="text-[11px] px-1.5 py-0.5 rounded-full text-[var(--color-primary-text)] bg-[var(--color-primary)]">{product.platform.toUpperCase()}</span>}
          <span className="text-[11px] px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}>{product.category_label || product.category_path || '--'}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
            {product.source || 'unknown'}
          </span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>{product.price_min == null && product.price_max == null ? '--' : `¥${(product.price_min ?? product.price_max).toFixed(2)}`}</span>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>售 {product.sales_volume == null ? '--' : product.sales_volume.toLocaleString()}</span>
        </div>
        {product.sales_growth_rate != null && (
          <div className="text-[11px]" style={{ color: product.sales_growth_rate > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {product.sales_growth_rate > 0 ? '↑' : '↓'} {(Math.abs(product.sales_growth_rate) * 100).toFixed(0)}%
          </div>
        )}
        <button onClick={() => onCapture(product)}
          className="mt-2 text-[11px] font-medium px-2 py-1 rounded-md shrink-0 hover:opacity-80 text-[var(--color-primary-text)]"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          <ShoppingCart className="w-2.5 h-2.5 inline mr-0.5" />
          加入备选
        </button>
      </div>
    </div>
  )
}

function ManualAddCard({ showAddForm, setShowAddForm, addName, setAddName, addForm, setAddForm, categoryOptions, onAdd }: any) {
  const reset = () => {
    setShowAddForm(false)
    setAddName('')
    setAddForm({ price_min: '', price_max: '', sales_volume: '', sales_growth_rate: '', category_path: '' })
  }
  return (
    <Card className="border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/30 transition-all flex items-center justify-center cursor-pointer" onClick={() => { if (!showAddForm) setShowAddForm(true) }}>
      <CardContent className="pt-4 pb-4 w-full">
        {showAddForm ? (
          <div className="space-y-2.5" onClick={e => e.stopPropagation()}>
            <p className="text-xs font-medium text-[var(--color-muted)] text-center border-b border-[var(--color-border)] pb-2">手动添加热卖商品 <span className="text-[11px] text-[var(--color-muted)] ml-1">（按所选平台和市场录入）</span></p>
            <input type="text" className="w-full text-sm border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none" placeholder="* 商品名称" value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') reset() }} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <ManualInput label="最低价 (¥)" field="price_min" value={addForm.price_min} setAddForm={setAddForm} step="0.01" />
              <ManualInput label="最高价 (¥)" field="price_max" value={addForm.price_max} setAddForm={setAddForm} step="0.01" />
              <ManualInput label="销量" field="sales_volume" value={addForm.sales_volume} setAddForm={setAddForm} />
              <ManualInput label="增长率 (%)" field="sales_growth_rate" value={addForm.sales_growth_rate} setAddForm={setAddForm} step="1" />
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-muted)] mb-0.5">商品分类</p>
              <select className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:border-[var(--color-primary)] outline-none appearance-none bg-[var(--color-surface)]" value={addForm.category_path} onChange={e => setAddForm({ ...addForm, category_path: e.target.value })}>
                <option value="">-- 选择分类（选填） --</option>
                {categoryOptions.map((category: any) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-center pt-1">
              <button onClick={onAdd} disabled={!addName.trim()} className="text-xs bg-[var(--color-primary)] text-[var(--color-primary-text)] px-5 py-1.5 rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-40">确认添加</button>
              <button onClick={reset} className="text-xs text-[var(--color-muted)] px-3 py-1.5 hover:text-[var(--color-fg)]">取消</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            <Plus className="w-8 h-8 text-[var(--color-muted)] mb-2" />
            <p className="text-sm font-medium text-[var(--color-muted)]">手动添加</p>
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5">按标准商品模型录入</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ManualInput({ label, field, value, setAddForm, step }: any) {
  return (
    <div>
      <p className="text-[11px] text-[var(--color-muted)] mb-0.5">{label}</p>
      <input type="number" step={step} className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:border-[var(--color-primary)] outline-none" placeholder="请输入实际值" value={value} onChange={e => setAddForm((prev: any) => ({ ...prev, [field]: e.target.value }))} />
    </div>
  )
}

export function PaginationBar({ safePage, totalPages, total, onPage }: any) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 mt-2">
      <button onClick={() => onPage(1)} disabled={safePage <= 1} className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">首页</button>
      <button onClick={() => onPage(safePage - 1)} disabled={safePage <= 1} className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">上一页</button>
      <span className="text-xs text-[var(--color-muted)]">第 {safePage} / {totalPages} 页（共 {total} 个）</span>
      <button onClick={() => onPage(safePage + 1)} disabled={safePage >= totalPages} className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">下一页</button>
      <button onClick={() => onPage(totalPages)} disabled={safePage >= totalPages} className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">末页</button>
    </div>
  )
}
