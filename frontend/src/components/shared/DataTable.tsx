import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  className?: string
  width?: string
}

export interface PaginationMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: string
  loading?: boolean
  emptyMessage?: string
  emptyAction?: React.ReactNode
  pagination?: PaginationMeta
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  loading,
  emptyMessage = '暂无数据',
  emptyAction,
  pagination,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onSelectionChange,
  onSort,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      const newDir = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(newDir)
      onSort?.(key, newDir)
    } else {
      setSortKey(key)
      setSortDir('asc')
      onSort?.(key, 'asc')
    }
  }

  const toggleSelect = (id: string) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const toggleAll = () => {
    if (!onSelectionChange || !selectedIds) return
    if (selectedIds.size === data.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(data.map((d) => String((d as Record<string, unknown>)[keyField]))))
    }
  }

  const allSelected = data.length > 0 && selectedIds?.size === data.length

  const getRowId = (row: T) => String((row as Record<string, unknown>)[keyField])

  if (loading) {
    return (
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="luxury-skeleton h-11 animate-pulse rounded-[var(--radius-lg)]" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="luxury-empty-state flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center shadow-[var(--shadow-sm)]">
          <div className="mb-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] p-3 text-[var(--color-primary)]">
          <Inbox className="h-8 w-8" />
        </div>
        <p className="text-sm text-[var(--color-muted)] mb-3">{emptyMessage}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div>
      <div className="materio-table-shell luxury-table-shell overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        <table className="materio-table professional-table min-w-full divide-y divide-[var(--color-border)]">
          <thead>
            <tr>
              {onSelectionChange && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] bg-[var(--color-surface)]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-[18px] py-3.5 text-left text-[13px] font-semibold text-[var(--color-muted)] uppercase tracking-[0.04em]',
                    col.sortable && 'cursor-pointer select-none hover:text-[var(--color-fg)]',
                    col.className
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="text-[var(--color-border)]">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)] transition-colors">
            {data.map((row) => {
              const rowId = getRowId(row)
              return (
                <tr
                  key={rowId}
                  className={cn(
                    'transition-[background,box-shadow] hover:bg-[var(--color-primary-light)]',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {onSelectionChange && (
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(rowId) ?? false}
                        onChange={() => toggleSelect(rowId)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] bg-[var(--color-surface)]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-[18px] py-3.5 text-sm text-[var(--color-fg)]', col.className)}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="luxury-pagination mt-4 flex items-center justify-between rounded-[var(--radius-lg)] px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <span>
              {pagination.page_size * (pagination.page - 1) + 1}-
              {Math.min(pagination.page * pagination.page_size, pagination.total)} of{' '}
              {pagination.total}
            </span>
            {onPageSizeChange && (
              <select
                value={pagination.page_size}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="ml-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-fg)] shadow-none"
              >
                {[20, 50, 100].map((s) => (
                  <option key={s} value={s}>{s}/page</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="上一页"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(pagination.total_pages, 5) }).map((_, i) => {
              const pageNum = Math.max(1, Math.min(pagination.page - 2, pagination.total_pages - 4)) + i
              if (pageNum > pagination.total_pages) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  className={cn(
                    'h-8 w-8 rounded-[var(--radius-md)] text-sm font-semibold transition-colors',
                    pageNum === pagination.page
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              aria-label="下一页"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
