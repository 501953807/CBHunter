import { Button } from '../../components/ui/Button'

interface Props {
  selectedCount: number
  priceValue: string
  stockValue: string
  updatingPrice: boolean
  updatingStock: boolean
  onPriceChange: (value: string) => void
  onStockChange: (value: string) => void
  onApplyPrice: () => void
  onApplyStock: () => void
  onPublish: () => void
  onDelete: () => void
  onClear: () => void
}

export function ProductBulkToolbar({
  selectedCount, priceValue, stockValue, updatingPrice, updatingStock,
  onPriceChange, onStockChange, onApplyPrice, onApplyStock, onPublish, onDelete, onClear,
}: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
    >
      <span className="font-medium">已选 {selectedCount} 项</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={priceValue}
        onChange={event => onPriceChange(event.target.value)}
        placeholder="成本价"
        className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-fg)]"
      />
      <Button variant="secondary" size="sm" onClick={onApplyPrice} disabled={updatingPrice || priceValue === ''}>
        {updatingPrice ? '改价中' : '批量设置成本价'}
      </Button>
      <input
        type="number"
        min="0"
        step="1"
        value={stockValue}
        onChange={event => onStockChange(event.target.value)}
        placeholder="店铺库存"
        className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-fg)]"
      />
      <Button variant="secondary" size="sm" onClick={onApplyStock} disabled={updatingStock || stockValue === ''}>
        {updatingStock ? '改库存中' : '批量设置店铺库存'}
      </Button>
      <Button variant="secondary" size="sm" onClick={onPublish}>发布</Button>
      <Button variant="danger" size="sm" onClick={onDelete}>删除</Button>
      <button onClick={onClear} className="ml-auto text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
        取消选择
      </button>
    </div>
  )
}
