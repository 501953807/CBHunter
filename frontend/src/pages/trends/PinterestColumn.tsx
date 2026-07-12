import { useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
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

export function PinterestColumn({ categories, selectedCat, onSelectCat, trendData }: Props) {
  const [searchTerm, setSearchTerm] = useState('')

  const pinterestKeywords = trendData?.keywords_by_source?.pinterest || []

  const filtered = searchTerm
    ? pinterestKeywords.filter((kw: any) => kw.keyword.toLowerCase().includes(searchTerm.toLowerCase()))
    : pinterestKeywords

  const handleAddToSourcing = async (kw: any) => {
    try {
      await addToSourcing({
        source_name: 'pinterest',
        source_type: 'trend_hotspot',
        product_name: kw.keyword,
        category: selectedCat,
        notes: `Pinterest Trends: ${kw.keyword}`,
      })
    } catch (e: any) { logger.error('Add Pinterest trend to sourcing failed', e) }
  }

  return (
    <div className="flex flex-col space-y-4 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📌</span>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-fg)' }}>Pinterest Trends</h2>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{filtered.length}个</span>
        </div>
        <a
          href="https://www.pinterest.com/ideas/"
          target="_blank" rel="noopener noreferrer"
          className="text-[11px] inline-flex items-center gap-1 hover:underline"
          style={{ color: 'var(--color-accent)' }}
        >
          <ExternalLink className="w-3 h-3" /> 打开
        </a>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />
        <input
          type="text"
          placeholder="搜索 Pin..."
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

      <CategoryPills categories={categories} selected={selectedCat} onChange={onSelectCat} />

      {/* Pin image grid placeholder */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.slice(0, 6).map((kw: any) => (
          <div
            key={kw.id}
            className="aspect-[3/4] rounded-lg flex items-center justify-center text-lg"
            style={{ background: 'var(--color-bg)' }}
          >
            {kw.image_url ? (
              <img src={kw.image_url} alt={kw.keyword} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-3xl">📌</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-8">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>暂无 Pin 数据</p>
          </div>
        )}
      </div>

      {/* Pin keyword list */}
      <div className="grid grid-cols-1 gap-2">
        {filtered.map((kw: any) => (
          <TrendKeywordCard
            key={kw.id}
            kw={kw}
            onAddToSourcing={handleAddToSourcing}
            showTrendLine={false}
          />
        ))}
      </div>
    </div>
  )
}
