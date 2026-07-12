import { useEffect, useState } from "react"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { useToast } from "../../components/ui/Toast"
import { listDiscoveryCategories } from "../../api/discovery"
import {
  calculateSourcingCost,
  createSourcingSupplier,
  deleteSourcingItem,
  listSourcingItems,
  listSourcingSuppliers,
  recordSourcingPurchase,
  search1688Suppliers,
  updateSourcingStage,
} from "../../api/sourcing"
import { logger } from "../../utils/logger"
import type { DictShape } from "./TrendDiscoveryTypes"
import { PipelineItemCard } from "./TrendPipelineItemCard"
import { FilterPillCard, PipelineCountBar, PipelineEmptyState, PipelineLoading, PipelinePagination } from "./TrendPipelinePanels"
import type { CostPayload, PurchaseForm, SupplierForm } from "./TrendPipelineUtils"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import type { ApiResponse } from "../../types/common"
import type { SourcingItem, SourcingSupplier } from "../../types/sourcing"

const PAGE_SIZE = 20
const EMPTY_SUPPLIER_FORM: SupplierForm = { supplier_name: '', purchase_price_rmb: '', supplier_url: '', product_image: '', notes: '' }
const EMPTY_PURCHASE_FORM: PurchaseForm = { supplier_id: '', quantity: '', unit_cost_rmb: '', domestic_shipping_rmb: '', description: '' }

export function PipelineTab({ dict }: { dict: DictShape }) {
  const [items, setItems] = useState<SourcingItem[]>([])
  const [itemsEvidence, setItemsEvidence] = useState<ApiResponse<SourcingItem[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filterCat, setFilterCat] = useState('')
  const [filterMkt, setFilterMkt] = useState('')
  const [catLabels, setCatLabels] = useState<any[]>([])
  const [mktLabels, setMktLabels] = useState<any[]>([])
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Record<string, SourcingSupplier[]>>({})
  const [supplierEvidence, setSupplierEvidence] = useState<Record<string, ApiResponse<SourcingSupplier[]>>>({})
  const [addingSupplier, setAddingSupplier] = useState<string | null>(null)
  const [supForm, setSupForm] = useState<SupplierForm>(EMPTY_SUPPLIER_FORM)
  const [purchasingFor, setPurchasingFor] = useState<string | null>(null)
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(EMPTY_PURCHASE_FORM)
  const [searching1688For, setSearching1688For] = useState<string | null>(null)
  const [eightyEightResults, setEightyEightResults] = useState<any>(null)
  const [loading1688, setLoading1688] = useState(false)
  const toast = useToast()
  const confirmAction = useConfirm()

  const loadItems = async (nextPage: number) => {
    setLoading(true)
    try {
      const [itemsRes, catRes] = await Promise.all([
        listSourcingItems({
          category: filterCat || undefined,
          market: filterMkt || undefined,
          page: nextPage,
          page_size: PAGE_SIZE,
        } as any),
        listDiscoveryCategories(),
      ])
      setItems(itemsRes.data || [])
      setItemsEvidence(itemsRes)
      setTotal(itemsRes.meta?.total || 0)
      setTotalPages(itemsRes.meta?.total_pages || 0)
      if (catRes.data) {
        const data = catRes.data as any
        setCatLabels(data.categories || [])
        setMktLabels(data.markets || [])
      }
    } catch (e: any) {
      logger.error('选品库加载失败', e)
      toast.addToast('error', '选品库加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadItems(page) }, [page, filterCat, filterMkt])

  const loadSuppliers = async (itemId: string) => {
    try {
      const res = await listSourcingSuppliers(itemId)
      setSuppliers(prev => ({ ...prev, [itemId]: res.data || [] }))
      setSupplierEvidence(prev => ({ ...prev, [itemId]: res }))
    } catch (e: any) {
      logger.error('供应商列表加载失败', e)
      toast.addToast('error', '供应商列表加载失败')
    }
  }

  const toggleExpand = async (itemId: string) => {
    if (expandedItem === itemId) {
      setExpandedItem(null)
      return
    }
    setExpandedItem(itemId)
    await loadSuppliers(itemId)
  }

  const deleteItem = async (itemId: string) => {
    const ok = await confirmAction({
      title: '删除选品候选',
      message: '确定删除此选品？删除后会移出候选验证和后续成本测算链路。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteSourcingItem(itemId)
      await loadItems(page)
    } catch (e: any) {
      logger.error('删除选品失败', e)
      toast.addToast('error', e?.response?.data?.detail || '删除选品失败')
    }
  }

  const submitSupplier = async (itemId: string) => {
    if (!supForm.supplier_name.trim()) return
    try {
      await createSourcingSupplier({
        sourcing_item_id: itemId,
        supplier_name: supForm.supplier_name.trim(),
        purchase_price_rmb: supForm.purchase_price_rmb !== '' ? parseFloat(supForm.purchase_price_rmb) : null,
        supplier_url: supForm.supplier_url || null,
        product_image: supForm.product_image || null,
        notes: supForm.notes || null,
      })
      setAddingSupplier(null)
      setSupForm(EMPTY_SUPPLIER_FORM)
      await loadSuppliers(itemId)
    } catch (e: any) {
      logger.error('新增供应商失败', e)
      toast.addToast('error', e?.response?.data?.detail || '新增供应商失败')
    }
  }

  const openPurchaseForm = (item: any, supplier?: any) => {
    setPurchasingFor(item.id)
    setPurchaseForm({
      supplier_id: supplier?.id || '',
      quantity: '',
      unit_cost_rmb: supplier?.purchase_price_rmb != null ? String(supplier.purchase_price_rmb) : item.source_price_rmb == null ? '' : String(item.source_price_rmb),
      domestic_shipping_rmb: supplier?.shipping_estimate_rmb != null ? String(supplier.shipping_estimate_rmb) : '',
      description: '',
    })
  }

  const submitPurchase = async (itemId: string) => {
    const quantity = parseInt(purchaseForm.quantity, 10)
    const unitCost = parseFloat(purchaseForm.unit_cost_rmb)
    const shipping = parseFloat(purchaseForm.domestic_shipping_rmb)
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(shipping) || shipping < 0) {
      toast.addToast('error', '请填写有效的采购数量、单价和国内运费')
      return
    }
    try {
      const res = await recordSourcingPurchase(itemId, {
        supplier_id: purchaseForm.supplier_id || undefined,
        quantity,
        unit_cost_rmb: unitCost,
        domestic_shipping_rmb: shipping,
        description: purchaseForm.description || undefined,
      })
      toast.addToast('success', res.data?.total_rmb == null ? '采购记录已保存，成本待回传' : `已记录采购成本 ¥${res.data.total_rmb}`)
      setPurchasingFor(null)
      setPurchaseForm(EMPTY_PURCHASE_FORM)
      await loadItems(page)
    } catch (e: any) {
      logger.error('采购入账失败', e)
      toast.addToast('error', e?.response?.data?.detail || '采购入账失败')
    }
  }

  const updateStage = async (itemId: string, stage: string) => {
    try {
      await updateSourcingStage(itemId, stage)
      await loadItems(page)
    } catch (e: any) {
      logger.error('选品阶段推进失败', e)
      toast.addToast('error', e?.response?.data?.detail || '推进失败')
    }
  }

  const calculateCost = async (item: any, payload: CostPayload) => {
    try {
      const res = await calculateSourcingCost(item.id, payload)
      await loadItems(page)
      toast.addToast('success', `成本核算完成：总成本 ¥${res.data.total_cost_rmb}，利润 ¥${res.data.profit_rmb}，利润率 ${res.data.profit_margin_pct}%`)
    } catch (e: any) {
      logger.error('成本核算失败', e)
      toast.addToast('error', e?.response?.data?.detail || '成本核算失败')
    }
  }

  const searchSuppliers1688 = async (item: any) => {
    setSearching1688For(item.id)
    setLoading1688(true)
    setEightyEightResults(null)
    try {
      const res = await search1688Suppliers(item.product_name || item.product_name_cn || '', item.category || undefined)
      setEightyEightResults(res.data)
    } catch (e: any) {
      logger.error('1688 供应商搜索失败', e)
      toast.addToast('error', e?.response?.data?.detail || '1688 供应商搜索失败')
    } finally {
      setLoading1688(false)
    }
  }

  const updateFilter = (type: 'category' | 'market', value: string) => {
    if (type === 'category') setFilterCat(value)
    if (type === 'market') setFilterMkt(value)
    setPage(1)
  }

  const dictCats = dict?.categories || []
  const dictMkts = dict?.markets || []
  const pipelineStages = dict?.sourcing_pipeline_stages || []
  const displayCats = dictCats.length > 0 ? dictCats : catLabels
  const displayMkts = dictMkts.length > 0 ? dictMkts : mktLabels

  return (
    <div className="space-y-4">
      <FilterPillCard title="品类" allLabel="全品类" active={filterCat} items={displayCats} accent="primary"
        onChange={(value) => updateFilter('category', value)} />
      <FilterPillCard title="市场" allLabel="全部市场" active={filterMkt} items={displayMkts} accent="success"
        onChange={(value) => updateFilter('market', value)} />
      <PipelineCountBar filterCat={filterCat} filterMkt={filterMkt} cats={displayCats} markets={displayMkts} total={total} />
      <EvidenceBanner evidence={itemsEvidence} compact />

      {loading ? <PipelineLoading /> : items.length === 0 ? <PipelineEmptyState /> : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <PipelineItemCard
              key={item.id}
              item={item}
              pipelineStages={pipelineStages}
              displayMkts={displayMkts}
              expanded={expandedItem === item.id}
              itemSuppliers={suppliers[item.id] || []}
              supplierEvidence={supplierEvidence[item.id]}
              addingSupplier={addingSupplier}
              supForm={supForm}
              setSupForm={setSupForm}
              purchasingFor={purchasingFor}
              purchaseForm={purchaseForm}
              setPurchaseForm={setPurchaseForm}
              searching1688For={searching1688For}
              eightyEightResults={eightyEightResults}
              loading1688={loading1688}
              onToggleExpand={toggleExpand}
              onDelete={deleteItem}
              onStageChange={updateStage}
              onOpenPurchase={openPurchaseForm}
              onCancelPurchase={() => setPurchasingFor(null)}
              onSubmitPurchase={submitPurchase}
              onCalculateCost={calculateCost}
              onSearch1688={searchSuppliers1688}
              onSubmitSupplier={submitSupplier}
              onStartAddSupplier={setAddingSupplier}
              onCancelAddSupplier={() => setAddingSupplier(null)}
            />
          ))}
        </div>
      )}

      <PipelinePagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  )
}
