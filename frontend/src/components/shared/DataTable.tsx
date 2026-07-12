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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-[var(--color-border)] rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="mb-3 h-9 w-9 text-[var(--color-muted)]" />
        <p className="text-sm text-[var(--color-muted)] mb-3">{emptyMessage}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="min-w-full divide-y divide-[var(--color-border)]">
          <thead className="bg-[var(--color-border)]/40">
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
                    'px-4 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider',
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
                    'hover:bg-[var(--color-bg)] transition-colors',
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
                      className={cn('px-4 py-3 text-sm text-[var(--color-fg)]', col.className)}
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
        <div className="flex items-center justify-between pt-4">
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
                className="ml-2 rounded border border-[var(--color-border)] text-sm px-2 py-1 bg-[var(--color-surface)] text-[var(--color-fg)]"
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
              className="p-1.5 rounded hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-muted)]"
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
                    'w-8 h-8 rounded text-sm transition-colors',
                    pageNum === pagination.page
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
                      : 'hover:bg-[var(--color-border)] text-[var(--color-muted)]'
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
              className="p-1.5 rounded hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-muted)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
