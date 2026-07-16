import { ChevronDown, Globe, Plus } from "lucide-react"
import { Badge } from "../../components/ui/Badge"
import { Card, CardContent } from "../../components/ui/Card"
import {
  BasicCaptureInputs,
  CaptureSyncHint,
  HeatSelector,
  PlatformCaptureFields,
  PromptCapture,
  SupplyImageCapture,
  TrendCaptureFields,
} from "./ScoutCaptureFields"

const LAYER_COLORS: Record<string, string> = {
  trend: 'var(--color-primary)',
  platform: 'var(--color-warning)',
  supply: 'var(--color-success)',
  culture: 'var(--color-accent)',
}

const CATEGORY_COLORS: Record<string, string> = {
  trend: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  platform: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  supply_chain: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  social: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
  ai: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
}

const ACCESS_LABELS: Record<string, string> = {
  manual_evidence: '手工凭证',
  public_trend: '公开趋势',
  authorized_api: '授权接口',
}
const AUTOMATION_LABELS: Record<string, string> = {
  manual_only: '仅手工',
  public_available: '公开可采',
  requires_authorization: '待授权',
}

export function ScoutSourceCards({
  filteredSources,
  expandedSource,
  setExpandedSource,
  isTrendSource,
  isPlatformSource,
  isPromptSource,
  isImageSource,
  showCapture,
  setShowCapture,
  captureForm,
  setCaptureForm,
  platformOptions,
  marketOptions,
  categoryOptions,
  trendDirections,
  competitionLevels,
  cultureEditorRef,
  cultureFileRef,
  handleCultureFileChange,
  insertCultureImage,
  supplyFileRef,
  supplyPreview,
  handleSupplyFileChange,
  handleCapture,
  getHeatInfo,
  getLayerSubmitText,
  getLayerBtnText,
  setSupplyPreview,
  EMPTY_CAPTURE_FORM,
}: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredSources.map((source: any) => (
        <Card key={source.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <SourceHeader source={source} />
            <SourceInstructions source={source} expandedSource={expandedSource} setExpandedSource={setExpandedSource} />
            <div className="mt-3 pt-2 border-t border-[var(--color-border)]">
              {showCapture === source.id ? (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  {isPromptSource(source) ? (
                    <PromptCapture
                      cultureEditorRef={cultureEditorRef}
                      cultureFileRef={cultureFileRef}
                      handleCultureFileChange={handleCultureFileChange}
                      insertCultureImage={insertCultureImage}
                      handleCapture={() => handleCapture(source.id)}
                    />
                  ) : !isImageSource(source) && (
                    <BasicCaptureInputs captureForm={captureForm} setCaptureForm={setCaptureForm} />
                  )}
                  {isPlatformSource(source) && (
                    <PlatformCaptureFields
                      captureForm={captureForm}
                      setCaptureForm={setCaptureForm}
                      platformOptions={platformOptions}
                      marketOptions={marketOptions}
                      categoryOptions={categoryOptions}
                    />
                  )}
                  {isTrendSource(source) && (
                    <TrendCaptureFields
                      captureForm={captureForm}
                      setCaptureForm={setCaptureForm}
                      marketOptions={marketOptions}
                      categoryOptions={categoryOptions}
                      trendDirections={trendDirections}
                      competitionLevels={competitionLevels}
                    />
                  )}
                  {!isImageSource(source) && !isPromptSource(source) && (
                    <HeatSelector captureForm={captureForm} setCaptureForm={setCaptureForm} getHeatInfo={getHeatInfo} />
                  )}
                  <CaptureSyncHint source={source} isTrendSource={isTrendSource} isPlatformSource={isPlatformSource} isPromptSource={isPromptSource} />
                  {isImageSource(source) && (
                    <SupplyImageCapture
                      supplyFileRef={supplyFileRef}
                      supplyPreview={supplyPreview}
                      handleSupplyFileChange={handleSupplyFileChange}
                    />
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleCapture(source.id)}
                      disabled={
                        isImageSource(source) ? false :
                        isPromptSource(source) ? !(cultureEditorRef.current?.textContent?.trim()) :
                        (!captureForm.keyword.trim() || !captureForm.product_idea.trim())
                      }
                      className="text-xs bg-[var(--color-primary)] text-[var(--color-primary-text)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-40">
                      {getLayerSubmitText(source)}
                    </button>
                    <button onClick={() => {
                      setSupplyPreview(null)
                      if (cultureEditorRef.current) cultureEditorRef.current.innerHTML = ''
                      setShowCapture(null)
                      setCaptureForm(EMPTY_CAPTURE_FORM)
                    }}
                      className="text-xs text-[var(--color-muted)] px-2 py-1.5 hover:text-[var(--color-fg)]">
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCapture(source.id)}
                  className="flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary)] border border-dashed border-[var(--color-primary)] rounded-lg py-1.5 w-full justify-center">
                  <Plus className="w-3 h-3" /> 录入信号 · {getLayerBtnText(source)}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SourceHeader({ source }: { source: any }) {
  return (
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
          <Globe className="w-4 h-4" style={{ color: LAYER_COLORS[source.layer] || 'var(--color-muted)' }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{source.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {source.layer && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-bg)]" style={{ color: LAYER_COLORS[source.layer] || 'var(--color-muted)' }}>
              {source.layer_label || source.layer}
            </span>}
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[source.category] || 'bg-[var(--color-bg)] text-[var(--color-muted)]'}`}>
              {source.category_label || source.category}
            </span>
            <Badge variant={source.priority <= 1 ? 'danger' : source.priority <= 2 ? 'warning' : 'default'}>{source.frequency_label}</Badge>
            <span className="text-[11px] text-[var(--color-muted)]">每次约{source.total_time}分钟</span>
          </div>
          <SourceAccess source={source} />
        </div>
      </div>
    </div>
  )
}

function SourceAccess({ source }: { source: any }) {
  const automation = source.automation_status || (source.authorization_required ? 'requires_authorization' : 'manual_only')
  const tone = automation === 'public_available' ? 'success' : automation === 'requires_authorization' ? 'warning' : 'muted'
  const bg = tone === 'success' ? 'var(--color-success-light)' : tone === 'warning' ? 'var(--color-warning-light)' : 'var(--color-bg)'
  const color = tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-muted)'
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {source.capture_method && (
        <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}>
          {ACCESS_LABELS[source.capture_method] || source.capture_method}
        </span>
      )}
      <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: bg, color }}>
        {AUTOMATION_LABELS[automation] || automation}
      </span>
      {source.authorization_required && <span className="text-[10px] text-[var(--color-warning)]">需官方授权</span>}
      {source.evidence_required?.length > 0 && (
        <span className="text-[10px] text-[var(--color-muted)]">资料 {source.evidence_required.length} 项</span>
      )}
    </div>
  )
}

function SourceInstructions({ source, expandedSource, setExpandedSource }: any) {
  return (
    <div className="mt-2">
      <button onClick={() => setExpandedSource(expandedSource === source.id ? null : source.id)}
        className="flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary)] mb-1">
        <ChevronDown className={`w-3 h-3 transition-transform ${expandedSource === source.id ? 'rotate-180' : ''}`} />
        操作指引 ({source.instructions?.length || 0}步)
      </button>
      {source.access_note && (
        <p className="mb-1 rounded-lg bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
          {source.access_note}
        </p>
      )}
      {expandedSource === source.id && source.instructions?.map((inst: any) => (
        <div key={inst.step} className="flex items-start gap-2 py-1.5 text-xs text-[var(--color-muted)]">
          <span className="w-4 h-4 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[11px] flex items-center justify-center shrink-0 mt-0.5">{inst.step}</span>
          <span className="flex-1">{inst.action}</span>
          <span className="text-[var(--color-muted)] shrink-0 text-[11px]">{inst.time_minutes}分</span>
        </div>
      ))}
    </div>
  )
}
