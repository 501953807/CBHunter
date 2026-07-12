import { useState } from 'react'
import { BookmarkPlus, Search, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { useConfig } from '../../hooks/useConfig'
import { useDeleteResearch, useKeywordSearch, useSaveResearch, useSavedResearch } from '../../hooks/useResearch'

export function SavedResearchTab() {
  const { platforms } = useConfig()
  const [keyword, setKeyword] = useState('')
  const [platform, setPlatform] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const search = useKeywordSearch(searchTerm, platform)
  const saved = useSavedResearch()
  const save = useSaveResearch()
  const remove = useDeleteResearch()
  const result = search.data?.data

  const runSearch = () => {
    if (keyword.trim() && platform) setSearchTerm(keyword.trim())
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">关键词研究</h2></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="输入需要研究的真实关键词" />
            <Select value={platform} onChange={setPlatform} placeholder="选择平台" options={platforms.map(item => ({ value: item.id, label: item.label }))} />
            <Button onClick={runSearch} disabled={!keyword.trim() || !platform || search.isFetching}><Search className="mr-1 h-4 w-4" />{search.isFetching ? '查询中' : '查询'}</Button>
          </div>
          <EvidenceBanner evidence={search.data} compact />
          {result && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-fg)]">{result.keyword}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">搜索量 {result.search_volume ?? '--'} · 竞争度 {result.competition_level ?? '--'} · 均价 {result.avg_price == null ? '--' : `¥${result.avg_price}`}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => save.mutate({ keyword: result.keyword, platform: result.platform })} disabled={save.isPending}>
                  <BookmarkPlus className="mr-1 h-3.5 w-3.5" />{search.data?.status === 'ready' ? '保存研究' : '收藏关键词'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">已保存研究</h2></CardHeader>
        <CardContent>
          <EvidenceBanner evidence={saved.data} compact />
          {!saved.data?.data?.length ? <p className="py-8 text-center text-sm text-[var(--color-muted)]">暂无已保存关键词研究</p> : (
            <div className="space-y-2">{saved.data.data.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                <div><p className="text-sm font-medium text-[var(--color-fg)]">{item.keyword}</p><p className="text-xs text-[var(--color-muted)]">{item.platform} · 搜索量 {item.search_volume ?? '--'} · 竞争度 {item.competition_level ?? '--'}</p></div>
                <button title="删除收藏" onClick={() => remove.mutate(item.id)} className="p-1.5 text-[var(--color-danger)]"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
