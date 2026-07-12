import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { getMarketFlag } from "./TrendPipelineUtils"
import { PipelineCostPanel } from "./TrendPipelineCostPanel"
import { PipelineSupplierPanel } from "./TrendPipelineSupplierPanel"
import { Handshake, Package, Trash2 } from "lucide-react"

export function PipelineItemCard({
  item,
  pipelineStages,
  displayMkts,
  expanded,
  itemSuppliers,
  supplierEvidence,
  addingSupplier,
  supForm,
  setSupForm,
  purchasingFor,
  purchaseForm,
  setPurchaseForm,
  searching1688For,
  eightyEightResults,
  loading1688,
  onToggleExpand,
  onDelete,
  onStageChange,
  onOpenPurchase,
  onCancelPurchase,
  onSubmitPurchase,
  onCalculateCost,
  onSearch1688,
  onSubmitSupplier,
  onStartAddSupplier,
  onCancelAddSupplier,
}: any) {
  const extraData = item.extra_data || {}
  const titles = extraData.titles || {}
  const marketRecs = extraData.market_recs || []
  const sourceImage = item.source_image
    ? String(item.source_image).startsWith('/') || String(item.source_image).startsWith('http') || String(item.source_image).startsWith('data:')
      ? item.source_image
      : `/api/v1/discovery/images/${item.source_image}`
    : ''

  return (
    <Card>
      <CardContent className="pt-3 px-3.5 pb-3">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            {item.category && <Badge variant="default" className="text-[11px]">{item.category}</Badge>}
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-primary-light)] text-[var(--color-primary)]">待供应商</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onToggleExpand(item.id)}
              className={`text-xs ${expanded ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)] hover:text-[var(--color-success)]'}`}
              title="合作伙伴"><Handshake className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(item.id)}
              className="text-[var(--color-muted)] hover:text-[var(--color-danger)] text-xs" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-lg bg-[var(--color-bg)] flex items-center justify-center text-xl shrink-0 overflow-hidden">
            {sourceImage
              ? <img src={sourceImage} alt={item.product_name || '品源商品'} className="w-full h-full object-cover" loading="lazy" />
              : <Package className="w-5 h-5 text-[var(--color-muted)]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-fg)] leading-tight">{titles.chinese || item.product_name || '未命名'}</p>
            {titles.english && <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{titles.english}</p>}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {marketRecs.length > 0 ? marketRecs.map((mr: any, i: number) => (
                <span key={i} className="text-[11px] text-[var(--color-muted)]">{i + 1}. {mr.market}</span>
              )) : item.market ? (
                <span className="text-[11px] text-[var(--color-muted)]">
                  {getMarketFlag(displayMkts, item.market)} {displayMkts.find((m: any) => m.id === item.market)?.label || item.market}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {expanded && (
          <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-3">
            <PipelineCostPanel
              item={item}
              pipelineStages={pipelineStages}
              itemSuppliers={itemSuppliers}
              evidence={supplierEvidence}
              purchasingFor={purchasingFor}
              purchaseForm={purchaseForm}
              setPurchaseForm={setPurchaseForm}
              onStageChange={onStageChange}
              onOpenPurchase={onOpenPurchase}
              onCancelPurchase={onCancelPurchase}
              onSubmitPurchase={onSubmitPurchase}
              onCalculateCost={onCalculateCost}
            />
            <PipelineSupplierPanel
              item={item}
              itemSuppliers={itemSuppliers}
              addingSupplier={addingSupplier}
              supForm={supForm}
              setSupForm={setSupForm}
              searching1688For={searching1688For}
              eightyEightResults={eightyEightResults}
              loading1688={loading1688}
              onOpenPurchase={onOpenPurchase}
              onSearch1688={onSearch1688}
              onSubmitSupplier={onSubmitSupplier}
              onStartAddSupplier={onStartAddSupplier}
              onCancelAddSupplier={onCancelAddSupplier}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
