import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getContentWorkbench, type ContentWorkbenchItem } from '../../api/content'
import { Card, CardContent } from '../../components/ui/Card'
import {
  BulkActionToolbar,
  BulkActionWorkbench,
  ContentProductRailList,
  ContentQueueEmpty,
  ContentQueueError,
  QueuePagination,
  QueueSummaryBar,
  SelectionCommandDeck,
  SellerFilterToolbar,
} from './ContentProductQueueParts'
import { ContentProductSellerTable } from './ContentProductQueueTableParts'
import {
  bulkWorkflowUrl,
  getPageSize,
  hasAttributeValue,
  matchesProduct,
  type BulkActionKind,
} from './ContentProductQueueUtils'

export function ContentProductQueue({
  onSelect,
  onOpenListing,
  onOpenMediaWorkbench,
  initialProductId = '',
  layout = 'table',
  autoSelect = false,
}: {
  onSelect: (item: ContentWorkbenchItem) => void
  onOpenListing?: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
  initialProductId?: string
  layout?: 'table' | 'rail'
  autoSelect?: boolean
}) {
  const [selectedId, setSelectedId] = useState('')
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [queuePage, setQueuePage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [tablePageSize, setTablePageSize] = useState(20)
  const [bulkAction, setBulkAction] = useState<BulkActionKind | null>(null)
  const contentWorkbenchQuery = useQuery({
    queryKey: ['content-workbench'],
    queryFn: getContentWorkbench,
  })
  const workbench = contentWorkbenchQuery.data?.data || null

  useEffect(() => {
    const first = workbench?.items?.find(item => matchesProduct(item, initialProductId)) || (autoSelect ? workbench?.items?.[0] : undefined)
    if (!first) return
    const timer = window.setTimeout(() => {
      setSelectedId(first.work_item_id)
      const firstIndex = workbench?.items?.findIndex(item => item.work_item_id === first.work_item_id) ?? 0
      setQueuePage(Math.floor(Math.max(firstIndex, 0) / getPageSize(layout, tablePageSize)) + 1)
      onSelect(first)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [onSelect, initialProductId, layout, workbench, autoSelect, tablePageSize])

  const items = useMemo(
    () => (workbench?.items || []).filter(item => {
      const statusMatched = statusFilter === 'all' || item.content_status === statusFilter
      const keyword = searchTerm.trim().toLowerCase()
      const keywordMatched = !keyword || [item.product_name, item.target_platform, item.target_market, item.category].some(value => (value || '').toLowerCase().includes(keyword))
      return statusMatched && keywordMatched
    }),
    [searchTerm, statusFilter, workbench?.items],
  )
  const pageSize = getPageSize(layout, tablePageSize)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(queuePage, totalPages)
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const startIndex = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = Math.min(safePage * pageSize, items.length)
  const visibleIds = visibleItems.map(item => item.work_item_id)
  const selectedItems = useMemo(
    () => items.filter(item => checkedIds.includes(item.work_item_id)),
    [items, checkedIds],
  )
  const selectedPublishUrl = selectedItems.length > 0 ? bulkWorkflowUrl('/publish', selectedItems) : ''
  const selectedPricingUrl = selectedItems.length > 0 ? bulkWorkflowUrl('/pricing', selectedItems) : ''
  const selectedMediaGaps = selectedItems.filter(item => (item.media_readiness?.missing_image_count || 0) > 0).length
  const selectedContentGaps = selectedItems.filter(item => item.content_status !== 'ready' || item.content_gaps.length > 0).length
  const selectedAttributeGaps = selectedItems.filter(item => {
    const requiredAttributes = item.platform_requirements?.required_attributes || []
    const attributeValues = item.platform_requirements?.attribute_values || {}
    return requiredAttributes.some(field => !hasAttributeValue(attributeValues, field))
  }).length
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => checkedIds.includes(id))
  const partiallyChecked = visibleIds.some(id => checkedIds.includes(id)) && !allVisibleChecked

  const toggleVisible = () => {
    setCheckedIds(current => {
      if (allVisibleChecked) return current.filter(id => !visibleIds.includes(id))
      return Array.from(new Set([...current, ...visibleIds]))
    })
  }

  const toggleRow = (id: string) => {
    setCheckedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const runBulkAction = (action: BulkActionKind) => {
    if (selectedItems.length === 0) return
    setBulkAction(action)
  }

  const openRow = (item: ContentWorkbenchItem) => {
    setSelectedId(item.work_item_id)
    onSelect(item)
  }

  return (
    <Card className="content-product-queue-workbench h-full" data-ui="content-product-queue-workbench">
      <CardContent className="content-product-queue-content">
        <QueueSummaryBar metrics={workbench?.metrics} />
        {layout === 'table' ? (
          <SellerFilterToolbar
            metrics={workbench?.metrics}
            onPageSizeChange={(size) => { setTablePageSize(size); setQueuePage(1) }}
            onSearchChange={(value) => { setSearchTerm(value); setQueuePage(1) }}
            onStatusChange={(value) => { setStatusFilter(value); setQueuePage(1) }}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            tablePageSize={tablePageSize}
          />
        ) : null}
        {layout === 'table' && items.length > 0 ? (
          <BulkActionToolbar
            allVisibleChecked={allVisibleChecked}
            onRunBulkAction={runBulkAction}
            onToggleVisible={toggleVisible}
            partiallyChecked={partiallyChecked}
            selectedItems={selectedItems}
          />
        ) : null}
        {layout === 'table' && selectedItems.length > 0 ? (
          <SelectionCommandDeck
            onOpenListing={onOpenListing}
            onOpenMediaWorkbench={onOpenMediaWorkbench}
            onOpenRow={openRow}
            selectedAttributeGaps={selectedAttributeGaps}
            selectedContentGaps={selectedContentGaps}
            selectedItems={selectedItems}
            selectedMediaGaps={selectedMediaGaps}
            selectedPricingUrl={selectedPricingUrl}
            selectedPublishUrl={selectedPublishUrl}
          />
        ) : null}
        {layout === 'table' && bulkAction && selectedItems.length > 0 ? (
          <BulkActionWorkbench
            action={bulkAction}
            items={selectedItems}
            onClose={() => setBulkAction(null)}
            onOpenListing={(item) => {
              openRow(item)
              onOpenListing?.(item)
            }}
            onOpenMediaWorkbench={onOpenMediaWorkbench ? (item) => {
              openRow(item)
              onOpenMediaWorkbench(item)
            } : undefined}
          />
        ) : null}
        {items.length > 0 ? (
          <QueuePagination
            endIndex={endIndex}
            itemCount={items.length}
            onNext={() => setQueuePage(page => Math.min(totalPages, page + 1))}
            onPrevious={() => setQueuePage(page => Math.max(1, page - 1))}
            safePage={safePage}
            startIndex={startIndex}
            totalPages={totalPages}
          />
        ) : null}
        {contentWorkbenchQuery.isError ? (
          <ContentQueueError onRetry={() => contentWorkbenchQuery.refetch()} />
        ) : null}
        {!contentWorkbenchQuery.isError && items.length === 0 ? <ContentQueueEmpty /> : null}
        {items.length > 0 && layout === 'rail' ? (
          <ContentProductRailList items={visibleItems} onOpenRow={openRow} selectedId={selectedId} />
        ) : null}
        {items.length > 0 && layout === 'table' ? (
          <ContentProductSellerTable
            allVisibleChecked={allVisibleChecked}
            checkedIds={checkedIds}
            items={visibleItems}
            onOpenListing={onOpenListing}
            onOpenMediaWorkbench={onOpenMediaWorkbench}
            onOpenRow={openRow}
            onToggleRow={toggleRow}
            onToggleVisible={toggleVisible}
            partiallyChecked={partiallyChecked}
            selectedId={selectedId}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
