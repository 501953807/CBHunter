import { Bot, Camera, ChevronDown, ChevronUp, ScanText, Trash2 } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import type { DictShape } from "./TrendDiscoveryTypes"
import { getMarketFlag } from "./TrendPipelineUtils"
import { productImageSrc } from "../../utils/productImages"

export function PendingImagesPanel({
  activeId,
  images,
  error,
  thumbRef,
  onScroll,
  onSelect,
  onDelete,
  onRetry,
}: any) {
  return (
    <div className="w-[18%] shrink-0 flex flex-col gap-1">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>待处理</p>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{images.length}张</span>
      </div>
      <button onClick={() => onScroll('up')} className="text-[var(--color-muted)] hover:text-[var(--color-fg)] flex justify-center py-0.5"><ChevronUp className="w-4 h-4" /></button>
      <div ref={thumbRef} className="flex-1 overflow-y-auto space-y-[10px] max-h-[calc(100vh-260px)] scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
        {images.map((thumb: any) => (
          <div key={thumb.id}
            className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:opacity-90 p-[10px] group ${
              activeId === thumb.id ? 'border-[var(--color-primary)] shadow-md' : 'border-transparent hover:border-[var(--color-border)]'
            }`}
            style={{ background: 'var(--color-surface)' }}>
            <div onClick={() => onSelect(thumb)}>
              {thumb.image_url ? <img src={productImageSrc(thumb.image_url)} alt="待分析商品" className="w-full aspect-square object-cover rounded" /> : <div className="w-full aspect-square flex items-center justify-center"><Camera className="w-6 h-6 text-[var(--color-muted)]" /></div>}
              <div className="flex gap-0.5 mt-1">
                {thumb.ai_used && <span className="text-[11px] bg-[var(--color-success)] text-[var(--color-primary-text)] px-1 rounded">AI</span>}
                {thumb.status === 'discovered' && <span className="text-[11px] bg-[var(--color-warning)] text-[var(--color-primary-text)] px-1 rounded">待</span>}
              </div>
            </div>
            <button onClick={(e) => onDelete(e, thumb.id)}
              className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--color-overlay)] hover:bg-[var(--color-danger)] text-[var(--color-primary-text)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              title="删除图片">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {error && (
          <div className="text-center py-6">
            <p className="text-xs text-[var(--color-danger)]">加载失败</p>
            <button onClick={onRetry} className="text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary)] mt-1">点击重试</button>
          </div>
        )}
        {!error && images.length === 0 && (
          <div className="text-center py-6" style={{ color: 'var(--color-muted)' }}>
            <p className="text-xs">暂无图片</p>
            <p className="text-[11px] mt-1">从品源管理上传</p>
          </div>
        )}
      </div>
      <button onClick={() => onScroll('down')} className="text-[var(--color-muted)] hover:text-[var(--color-fg)] flex justify-center py-0.5"><ChevronDown className="w-4 h-4" /></button>
    </div>
  )
}

export function UploadImageCard({ data, aiUsed, discoveryId, uploading, preview, fileRef, dict, selCategory, setSelCategory, selMarketUpload, setSelMarketUpload, onUpload, onReanalyze }: any) {
  const canUpload = Boolean(selCategory && selMarketUpload && !uploading)
  return (
    <Card className="h-full">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">上传产品图片</h3>
          {data && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                aiUsed ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
              }`}>
                {aiUsed ? <><Bot className="w-3 h-3" />Gemini AI</> : <><ScanText className="w-3 h-3" />OCR + 规则</>}
              </span>
              {discoveryId && (
                <button onClick={onReanalyze} disabled={uploading}
                  className="text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary)] border border-[var(--color-primary)] rounded px-1.5 py-0.5 disabled:opacity-40">
                  重新分析
                </button>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DictSelect label="品类" value={selCategory} onChange={setSelCategory} disabled={uploading} options={dict?.categories || []} />
          <DictSelect label="目标市场" value={selMarketUpload} onChange={setSelMarketUpload} disabled={uploading} options={dict?.markets || []} withFlag />
        </div>
        <div className={`border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 text-center transition-colors ${canUpload ? 'cursor-pointer hover:border-[var(--color-primary)]' : 'cursor-not-allowed opacity-60'}`}
          aria-disabled={!canUpload} onClick={() => canUpload && fileRef.current?.click()}>
          {preview ? <img src={preview} alt="待上传商品" className="max-h-36 mx-auto rounded-lg" /> : (
            <div className="py-6">
              <p className="text-sm text-[var(--color-muted)]">点击上传产品图片</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{canUpload ? '支持 JPG / PNG' : '请先选择品类和目标市场'}</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={!canUpload} onChange={onUpload} />
        </div>
      </CardContent>
    </Card>
  )
}

function DictSelect({ label, value, onChange, disabled, options, withFlag = false }: any) {
  return (
    <div>
      <p className="text-[11px] text-[var(--color-muted)] mb-0.5">{label}</p>
      <select className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 focus:border-[var(--color-primary)] outline-none appearance-none bg-[var(--color-surface)]"
        value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
        <option value="">请选择</option>
        {options.map((item: any) => <option key={item.id} value={item.id}>{withFlag ? `${item.flag || ''} ${item.label}` : item.label}</option>)}
      </select>
    </div>
  )
}

export function AnalysisPreviewPanel({ analysis, marketRecs, matchedTrends, dict }: { analysis: any; marketRecs: any[]; matchedTrends: any[]; dict: DictShape }) {
  return (
    <div className="lg:col-span-2 space-y-3 flex flex-col">
      <PositioningCard analysis={analysis} />
      <div className="grid grid-cols-3 gap-3 flex-[42]">
        <SummaryCard title="📂 匹配品类" value={analysis ? analysis.product_positioning?.product_type?.split('/')[0]?.trim() || '--' : '上传图片后自动分析'} strong={Boolean(analysis)} />
        <Card>
          <CardContent className="pt-3 px-3 pb-3">
            <p className="text-[11px] text-[var(--color-muted)] mb-1">🌍 推荐市场</p>
            {analysis ? marketRecs.slice(0, 2).map((m: any, i: number) => <p key={i} className="text-xs text-[var(--color-fg)]">{i === 0 ? '🥇 ' : '🥈 '}{m.market}</p>) : <p className="text-xs text-[var(--color-muted)]">上传图片后自动分析</p>}
          </CardContent>
        </Card>
        <TrendMatchCard analysis={analysis} matchedTrends={matchedTrends} dict={dict} />
      </div>
    </div>
  )
}

function PositioningCard({ analysis }: { analysis: any }) {
  const fields = [
    { label: '📂 品类', value: analysis?.product_positioning?.product_type },
    { label: '🎨 风格', value: analysis?.product_positioning?.style },
    { label: '👥 人群', value: analysis?.product_positioning?.audience },
    { label: '📍 场景', value: analysis?.product_positioning?.scene },
    { label: '🧵 材质', value: analysis?.product_positioning?.material },
  ]
  return (
    <Card className="flex-[58]">
      <CardContent className="pt-4">
        <h3 className="font-semibold text-[var(--color-fg)] mb-3">产品基础定位</h3>
        <div className="grid grid-cols-5 gap-2">
          {fields.map((item) => (
            <div key={item.label} className="bg-[var(--color-bg)] rounded-lg p-2.5 text-center min-h-[60px] flex flex-col justify-center">
              <p className="text-[11px] text-[var(--color-muted)] mb-0.5">{item.label}</p>
              <p className={analysis ? "text-xs font-medium text-[var(--color-fg)] leading-tight" : "text-xs text-[var(--color-muted)]"}>{item.value || '--'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCard({ title, value, strong }: { title: string; value: string; strong: boolean }) {
  return (
    <Card>
      <CardContent className="pt-3 px-3 pb-3">
        <p className="text-[11px] text-[var(--color-muted)] mb-1">{title}</p>
        <p className={strong ? "text-sm font-semibold text-[var(--color-fg)]" : "text-xs text-[var(--color-muted)]"}>{value}</p>
      </CardContent>
    </Card>
  )
}

function TrendMatchCard({ analysis, matchedTrends, dict }: any) {
  const grouped = matchedTrends.reduce((acc: any, item: any) => {
    const market = item.market || '其他'
    if (!acc[market]) acc[market] = []
    if (acc[market].length < 3) acc[market].push(item.keyword)
    return acc
  }, {})
  return (
    <Card>
      <CardContent className="pt-3 px-3 pb-3">
        <p className="text-[11px] text-[var(--color-muted)] mb-1">🔥 匹配趋势词</p>
        {analysis && matchedTrends.length > 0 ? (
          <div className="space-y-1">
            {Object.entries(grouped).map(([market, keywords]: [string, any]) => (
              <div key={market} className="flex items-start gap-1">
                <span className="text-[11px] text-[var(--color-muted)] shrink-0 mt-0.5">{getMarketFlag(dict?.markets || [], market) || market}</span>
                <div className="flex flex-wrap gap-1">
                  {keywords.map((keyword: string, index: number) => <span key={index} className="text-[11px] bg-[var(--color-primary-light)] text-[var(--color-primary)] px-1.5 py-0.5 rounded">{keyword}</span>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-[11px] text-[var(--color-muted)]">{analysis ? '暂无匹配' : '上传图片后自动分析'}</span>
            {analysis && <p className="text-[11px] text-[var(--color-muted)]">上传后系统自动匹配各市场趋势词</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
