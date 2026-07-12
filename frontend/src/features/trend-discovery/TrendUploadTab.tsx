import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, MouseEvent } from "react"
import { Globe } from "lucide-react"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { analyzeDiscovery, confirmDiscovery, deleteDiscovery, listPendingImages, reanalyzeDiscovery, uploadDiscoveryImage } from "../../api/discovery"
import { logger } from "../../utils/logger"
import type { DictShape } from "./TrendDiscoveryTypes"
import {
  AnalysisPreviewPanel,
  PendingImagesPanel,
  UploadImageCard,
} from "./TrendUploadPanels"
import { AnalysisProgressCard, FullAnalysisResults } from "./TrendUploadResults"

export function UploadTab({ data, setData, preview, setPreview, uploading, setUploading, dict }: {
  data: any
  setData: (d: any) => void
  preview: string | null
  setPreview: (p: string | null) => void
  uploading: boolean
  setUploading: (u: boolean) => void
  dict: DictShape
}) {
  const confirmAction = useConfirm()
  const [confirming, setConfirming] = useState(false)
  const [confirmedId, setConfirmedId] = useState<string | null>(null)
  const [selCategory, setSelCategory] = useState('')
  const [selMarketUpload, setSelMarketUpload] = useState('')
  const [pendingImages, setPendingImages] = useState<any[]>([])
  const [pendingError, setPendingError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  const loadPending = async () => {
    setPendingError(null)
    try {
      const res = await listPendingImages()
      if (res.data) setPendingImages(res.data as any[])
    } catch (e: any) {
      logger.error('Load pending discovery images failed', e)
      setPendingError('加载待处理图片失败')
    }
  }

  useEffect(() => { loadPending() }, [])

  const handleDeleteImage = async (e: MouseEvent, thumbId: string) => {
    e.stopPropagation()
    const ok = await confirmAction({
      title: '删除选品图片',
      message: '确认删除这张待处理选品图片？删除后对应图片分析、候选证据和待确认记录将被移除。',
      confirmText: '确认删除图片',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteDiscovery(thumbId)
      setPendingImages(prev => prev.filter(item => item.id !== thumbId))
      if (data?.id === thumbId) {
        setData(null)
        setPreview(null)
        setConfirmedId(null)
      }
    } catch (err: any) {
      logger.error('Delete image failed', err)
    }
  }

  const handleThumbnailClick = async (thumb: any) => {
    setPreview(thumb.image_url)
    setData(null)
    setConfirmedId(null)
    setUploading(true)
    try {
      const res = await analyzeDiscovery(thumb.id)
      setData(res.data)
    } catch (e: any) {
      logger.error('Analyze pending discovery failed', e)
    }
    setUploading(false)
  }

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selCategory || !selMarketUpload) return
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    setData(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', selCategory)
      form.append('market', selMarketUpload)
      const res = await uploadDiscoveryImage(form)
      setData(res.data)
      loadPending()
    } catch (err: any) {
      logger.error('Upload discovery image failed', err)
    }
    setUploading(false)
  }

  const handleReanalyze = async () => {
    if (!data?.id) return
    setUploading(true)
    try {
      const res = await reanalyzeDiscovery(data.id)
      setData(res.data)
      loadPending()
    } catch (e: any) {
      logger.error('Reanalyze failed', e)
    }
    setUploading(false)
  }

  const handleConfirm = async (discoveryId: string) => {
    setConfirming(true)
    try {
      await confirmDiscovery(discoveryId)
      setConfirmedId(discoveryId)
      setPendingImages(prev => prev.filter(item => item.id !== discoveryId))
    } catch (e: any) {
      logger.error('Confirm discovery failed', e?.response?.data || e?.message || e)
    }
    setConfirming(false)
  }

  const analysis = data?.analysis
  const matchedTrends = data?.matched_trends || []
  const marketRecs = data?.market_recommendations || []
  const discoveryId = data?.id

  const scrollThumbs = (dir: 'up' | 'down') => {
    if (thumbRef.current) thumbRef.current.scrollBy({ top: dir === 'up' ? -200 : 200, behavior: 'smooth' })
  }

  return (
    <div className="flex gap-4">
      <PendingImagesPanel
        activeId={data?.id}
        images={pendingImages}
        error={pendingError}
        thumbRef={thumbRef}
        onScroll={scrollThumbs}
        onSelect={handleThumbnailClick}
        onDelete={handleDeleteImage}
        onRetry={loadPending}
      />
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-accent-light)] border border-[var(--color-accent)] rounded-lg">
          <Globe className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-xs text-[var(--color-accent)]">
            <strong>网络环境提示：</strong>图片上传后的 AI 分析需要 VPN 环境（Gemini API）。
            确认选品后，在「选品库」中匹配 1688 供应商需切换回国内网络。
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-fr">
          <UploadImageCard
            data={data}
            aiUsed={data?.ai_used}
            discoveryId={discoveryId}
            uploading={uploading}
            preview={preview}
            fileRef={fileRef}
            dict={dict}
            selCategory={selCategory}
            setSelCategory={setSelCategory}
            selMarketUpload={selMarketUpload}
            setSelMarketUpload={setSelMarketUpload}
            onUpload={handleUpload}
            onReanalyze={handleReanalyze}
          />
          <AnalysisPreviewPanel analysis={analysis} marketRecs={marketRecs} matchedTrends={matchedTrends} dict={dict} />
        </div>
        <FullAnalysisResults
          analysis={analysis}
          discoveryId={discoveryId}
          confirmedId={confirmedId}
          confirming={confirming}
          uploading={uploading}
          onConfirm={handleConfirm}
        />
        {!analysis && uploading && <AnalysisProgressCard />}
      </div>
    </div>
  )
}
