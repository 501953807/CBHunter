import { useEffect, useRef, useState } from "react"
import { Globe, ShoppingCart, Sparkles, TriangleAlert } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { aiRecommend } from "../../api/discovery"
import { listScoutPrompts } from "../../api/scout"
import { useAddToSourcing } from "../../hooks/useResearch"
import { logger } from "../../utils/logger"
import type { DictShape } from "./TrendDiscoveryTypes"

/* ========== Recommender Tab - Gemini AI Powered ========== */

export function RecommenderTab({ dict: _dict }: { dict: DictShape }) {
  const promptEditorRef = useRef<HTMLDivElement>(null)
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const addToSourcingMutation = useAddToSourcing()
  const [addingAiResult, setAddingAiResult] = useState(false)
  const [manualProductInput, setManualProductInput] = useState('')
  const [prompts, setPrompts] = useState<any[]>([])

  useEffect(() => {
    listScoutPrompts().then(r => {
      if (r.data) setPrompts(r.data as any[])
    }).catch((e) => { logger.error('Dictionary load failed', e) })
  }, [])

  const setPromptFromCard = (content: string) => {
    setPrompt(content)
    setResult('')
    setError('')
    if (promptEditorRef.current) {
      promptEditorRef.current.textContent = content
    }
  }

  const handleAddAiResultToSourcing = async () => {
    if (!result.trim()) return
    setAddingAiResult(true)
    try {
      const lines = result.trim().split('\n').filter(l => l.trim())
      const firstLine = lines[0]?.replace(/^[#*\d.、\s]+/, '').trim() || 'AI推荐产品'
      await addToSourcingMutation.mutateAsync({
        source_name: 'recommend',
        source_type: 'ai_recommend',
        product_name: firstLine.slice(0, 200),
        notes: `AI选品分析结果\n\n${result.slice(0, 500)}`,
        extra_data: { full_analysis: result } })
    } catch (e: any) {
      logger.error('Failed to add keyword', e)
    }
    setAddingAiResult(false)
  }

  const addManualProductFromResult = async (productName: string) => {
    await addToSourcingMutation.mutateAsync({
      source_name: 'recommend',
      source_type: 'ai_recommend_extract',
      product_name: productName.slice(0, 200),
      notes: `从AI分析中提取: ${productName}`,
      extra_data: { full_analysis: result, extracted_from_ai: true } })
  }

  const handleAnalyze = async () => {
    const text = prompt
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setResult('')
    try {
      const res = await aiRecommend(text.trim())
      setResult(res.data?.content || '')
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'AI 分析失败，请检查API配置后重试')
    }
    setLoading(false)
  }

  const resetPrompt = () => {
    setPrompt('')
    setResult('')
    setError('')
    if (promptEditorRef.current) {
      promptEditorRef.current.textContent = ''
    }
  }

  return (
    <div className="flex gap-4">
      {/* Left: 80% prompt + result */}
      <div className="w-[80%] space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-accent-light)] border border-[var(--color-accent)] rounded-lg">
          <Globe className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-xs text-[var(--color-accent)]">
            <strong>网络环境提示：</strong>AI 分析需要 VPN 环境（调用 Gemini API）。
          </span>
        </div>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">AI 选品分析提示词</h3>
              <span className="text-[11px] text-[var(--color-muted)] ml-1">编辑或点击右侧提示词卡片加载</span>
            </div>
            <div
              ref={promptEditorRef}
              contentEditable
              suppressContentEditableWarning
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3.5 py-3 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none min-h-[220px] leading-relaxed text-[var(--color-fg)] whitespace-pre-wrap [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-[var(--color-muted)]"
              data-placeholder="编辑提示词，或点击右侧提示词卡片加载"
              onInput={(e) => setPrompt((e.target as HTMLDivElement).textContent || '')}
            />
            <div className="flex items-center gap-3 mt-3">
              <button onClick={handleAnalyze} disabled={loading || !prompt.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[var(--color-accent)] text-[var(--color-primary-text)] text-sm font-medium rounded-lg hover:bg-[var(--color-accent)] disabled:opacity-40 transition-colors">
              <Sparkles className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? 'AI 分析中...' : '开始分析'}
            </button>
            <button onClick={resetPrompt}
              className="text-xs text-[var(--color-muted)] px-3 py-2 hover:text-[var(--color-fg)]">
              重置提示词
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Loading indicator */}
      {loading && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-accent)]">Gemini AI 正在分析市场数据...</p>
                <p className="text-xs text-[var(--color-accent)]">根据提示词复杂度，大约需要 5-20 秒</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-[var(--color-accent-light)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] rounded-full animate-pulse" style={{width: '60%'}} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-sm text-[var(--color-danger)]">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">分析失败</p>
                <p className="text-xs text-[var(--color-danger)] mt-0.5">{error}</p>
                <p className="text-[11px] text-[var(--color-muted)] mt-1">
                  确保已在 .env 中配置有效的 AI_API_KEY=Gemini API密钥，或通过 AI 设置页面填写
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && !loading && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">AI 分析结果</h3>
              </div>
              <button onClick={handleAddAiResultToSourcing} disabled={addingAiResult || addToSourcingMutation.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-success)] bg-[var(--color-success-light)] border border-[var(--color-success)] rounded-lg hover:bg-[var(--color-success-light)] transition-colors disabled:opacity-40">
                <ShoppingCart className="w-3 h-3" />
                {addingAiResult ? '添加中...' : '加入选品库'}
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-[var(--color-fg)] leading-relaxed whitespace-pre-wrap text-sm">
              {result}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structured product extraction from AI results */}
      {result && !loading && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-[var(--color-success)]" />
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">从分析结果中提取商品</h3>
              <span className="text-[11px] text-[var(--color-muted)]">手动输入AI分析中提到的商品名称，逐条加入选品库</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="text"
                className="flex-1 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 focus:border-[var(--color-success)] outline-none"
                placeholder="输入商品名称（例如: 韩系尼龙饺子包）"
                value={manualProductInput}
                onChange={e => setManualProductInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualProductInput.trim()) {
                    addManualProductFromResult(manualProductInput.trim())
                    setManualProductInput('')
                  }
                }}
              />
              <button onClick={() => {
                if (manualProductInput.trim()) {
                  addManualProductFromResult(manualProductInput.trim())
                  setManualProductInput('')
                }
              }} disabled={!manualProductInput.trim() || addToSourcingMutation.isPending}
                className="px-4 py-2 bg-[var(--color-success)] text-[var(--color-primary-text)] text-sm rounded-lg hover:bg-[var(--color-success)] disabled:opacity-40 whitespace-nowrap">
                加入选品库
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <Card>
          <CardContent className="pt-4 text-center py-12 text-[var(--color-muted)]">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-[var(--color-accent)]" />
            <p className="text-sm">编辑提示词，或点击右侧提示词卡片</p>
            <p className="text-xs mt-1">Gemini AI 将根据提示词搜索分析市场爆款机会</p>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Right 20%: prompt cards from culture layer */}
      <div className="w-[20%] space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>潮流推荐</p>
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{prompts.length}个</span>
        </div>
        <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {prompts.map((p: any) => (
            <div key={p.id} onClick={() => { setPromptFromCard(p.product_idea) }}
              className="p-2.5 rounded-xl border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-accent)] hover:shadow-sm transition-all bg-[var(--color-surface)]">
              <p className="text-xs font-medium text-[var(--color-fg)] line-clamp-2">{p.keyword}</p>
              <div className="text-[11px] text-[var(--color-muted)] mt-1 line-clamp-3 [&_img]:max-h-8 [&_img]:rounded [&_img]:inline [&_img]:mx-0.5"
                dangerouslySetInnerHTML={{ __html: p.product_idea }} />
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[11px] text-[var(--color-muted)]">{p.source_name}</span>
                {p.heat_level > 0 && <span className="text-[11px] text-[var(--color-warning)] ml-auto">🔥{p.heat_level}</span>}
              </div>
            </div>
          ))}
          {prompts.length === 0 && (
            <div className="text-center py-6" style={{ color: 'var(--color-muted)' }}>
              <p className="text-xs">暂无推荐</p>
              <p className="text-[11px] mt-1">从品源管理-文化层添加</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
