import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { crossValidateTrends } from '../../api/smart'
import { logger } from '../../utils/logger'

interface Props {
  categories: unknown[]
  selectedCat: string
  trendData: any
  refreshData: () => void
}

export function CrossValidationColumn({ categories: _categories, selectedCat, trendData, refreshData: _refreshData }: Props) {
  const [loading, setLoading] = useState(false)
  const [crossData, setCrossData] = useState<any>(null)

  const googleKeywords = trendData?.keywords_by_source?.google_trends || []
  const pinterestKeywords = trendData?.keywords_by_source?.pinterest || []
  const overlapCount = crossData?.overlap_keywords?.length || googleKeywords.filter((g: any) =>
    pinterestKeywords.some((p: any) => p.keyword?.toLowerCase() === g.keyword?.toLowerCase())
  ).length

  const handleLoadCross = async () => {
    setLoading(true)
    try {
      const res = await crossValidateTrends({
        category: selectedCat,
        google_keywords: googleKeywords.map((k: any) => ({ keyword: k.keyword })),
        pinterest_keywords: pinterestKeywords.map((k: any) => ({ keyword: k.keyword })),
      })
      setCrossData(res.data)
    } catch (e: any) {
      logger.error('Cross validate trends failed, use local keyword overlap', e)
      const googleSet = new Set(googleKeywords.map((k: any) => k.keyword?.toLowerCase()))
      const overlap = pinterestKeywords.filter((p: any) => googleSet.has(p.keyword?.toLowerCase()))
      const score = googleKeywords.length > 0 ? Math.round((overlap.length / googleKeywords.length) * 100) : 0
      setCrossData({
        overlap_keywords: overlap.map((p: any) => ({
          keyword: p.keyword,
          pinterest_present: true,
          score: null,
        })),
        overlap_count: overlap.length,
        overlap_pct: score,
        suggestion: `双源精确重合度为 ${score}%，该结果只反映关键词交集，仍需结合竞品、成本和利润验证。`,
      })
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col space-y-4 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-fg)' }}>交叉验证</h2>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Google ∩ Pinterest</span>
        </div>
        <button
          onClick={handleLoadCross}
          disabled={loading}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)' }}
        >
          <Sparkles className={`w-3 h-3 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? '分析中...' : '分析'}
        </button>
      </div>

      {/* Overlap stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{crossData?.overlap_count || overlapCount}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>重合关键词</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-2xl font-bold" style={{ color: crossData?.overlap_pct > 30 ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {crossData?.overlap_pct || (googleKeywords.length > 0 ? Math.round((overlapCount / Math.max(googleKeywords.length, 1)) * 100) : 0)}%
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>重合度</p>
          </CardContent>
        </Card>
      </div>

      {/* Suggestion */}
      {crossData?.suggestion && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-medium"
          style={{
            background: crossData.overlap_pct > 30 ? 'var(--color-success-light)' : 'var(--color-info-light)',
            color: crossData.overlap_pct > 30 ? 'var(--color-success)' : 'var(--color-info)',
          }}
        >
          {crossData.suggestion}
        </div>
      )}

      {/* Overlap keyword list */}
      <div className="grid grid-cols-1 gap-2">
        {(crossData?.overlap_keywords || []).map((item: any) => (
          <Card key={item.keyword} className="hover:shadow-md transition-shadow card-lift">
            <CardContent className="pt-3 px-3.5 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{item.keyword}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="text-[11px]">Google 命中</Badge>
                    <span className="text-[11px]" style={{ color: 'var(--color-accent)' }}>Pinterest ✓</span>
                  </div>
                </div>
                <Badge variant="success">双源命中</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!crossData || crossData?.overlap_keywords?.length === 0) && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>点击「分析」交叉验证</p>
          </div>
        )}
      </div>
    </div>
  )
}
