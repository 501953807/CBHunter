import { useState } from 'react'
import { ExternalLink, TrendingUp, Search } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { CategoryPills } from './CategoryPills'
import { TrendKeywordCard } from './TrendKeywordCard'
import { addToSourcing } from '../../api/sourcing'
import type { DictCategory } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'

interface Props {
  categories: DictCategory[]
  selectedCat: string
  onSelectCat: (id: string) => void
  trendData: any
}

export function GoogleTrendsColumn({ categories, selectedCat, onSelectCat, trendData }: Props) {
  const [searchTerm, setSearchTerm] = useState('')

  const allKeywords = trendData?.keywords_by_source?.google_trends || []
  const filtered = searchTerm
    ? allKeywords.filter((kw: any) => kw.keyword.toLowerCase().includes(searchTerm.toLowerCase()))
    : allKeywords

  const handleAddToSourcing = async (kw: any) => {
    try {
      await addToSourcing({
        source_name: 'google_trends',
        source_type: 'trend_hotspot',
        product_name: kw.keyword,
        category: selectedCat,
        notes: `Google Trends: ${kw.keyword} | 趋势指数: ${kw.trend_index ?? '-'}`,
      })
    } catch (e: any) { logger.error('Add Google trend to sourcing failed', e) }
  }

  return (
    <div className="flex flex-col space-y-4 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-fg)' }}>Google Trends</h2>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{filtered.length}个</span>
        </div>
        <a
          href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(searchTerm || selectedCat)}`}
          target="_blank" rel="noopener noreferrer"
          className="text-[11px] inline-flex items-center gap-1 hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          <ExternalLink className="w-3 h-3" /> 打开
        </a>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />
        <input
          type="text"
          placeholder="搜索关键词..."
          className="w-full text-xs rounded-lg pl-8 pr-3 py-2 outline-none transition-colors"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-fg)',
          }}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Categories */}
      <CategoryPills categories={categories} selected={selectedCat} onChange={onSelectCat} />

      {/* IFrame embed */}
      <Card className="overflow-hidden">
        <div className="aspect-video bg-[var(--color-bg)] flex items-center justify-center">
          <TrendingUp className="w-8 h-8" style={{ color: 'var(--color-muted)' }} />
          <span className="text-xs ml-2" style={{ color: 'var(--color-muted)' }}>Google Trends Widget</span>
        </div>
      </Card>

      {/* Keyword list */}
      <div className="grid grid-cols-1 gap-2">
        {filtered.map((kw: any) => (
          <TrendKeywordCard
            key={kw.id}
            kw={kw}
            onAddToSourcing={handleAddToSourcing}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>暂无数据</p>
          </div>
        )}
      </div>
    </div>
  )
}
