import { Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Tabs } from '../ui/Tabs'

export function TrendingProductsToolbar({
  searchInput,
  setSearchInput,
  filterCategory,
  filterMarket,
  categories,
  markets,
  platformTabs,
  platformTab,
  onSearch,
  onCategoryChange,
  onMarketChange,
  onPlatformChange,
  onClear,
}: any) {
  const hasFilter = filterCategory || filterMarket || searchInput
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="搜索商品名称..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            className="text-xs rounded-lg border px-3 py-1.5 flex-1 outline-none"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
          />
          <Button size="sm" variant="outline" onClick={onSearch}>
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
        <Select
          options={[{ value: '', label: '全部分类' }, ...categories.map((item: any) => ({ value: item.id, label: item.label }))]}
          value={filterCategory}
          onChange={onCategoryChange}
          className="w-32"
        />
        <Select
          options={[{ value: '', label: '全部市场' }, ...markets.map((item: any) => ({ value: item.id, label: item.label }))]}
          value={filterMarket}
          onChange={onMarketChange}
          className="w-32"
        />
        {hasFilter && (
          <button onClick={onClear} className="text-xs underline" style={{ color: 'var(--color-primary)' }}>
            清除
          </button>
        )}
      </div>
      <Tabs tabs={platformTabs} activeTab={platformTab} onChange={onPlatformChange} />
    </>
  )
}
