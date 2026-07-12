import { useState, useEffect, useRef } from 'react'
import { logger } from '../../utils/logger'
import { getDictionary } from '../../api/config'
import { fetchTrends, getTrendSyncStatus, listTrends, uploadDiscoveryImage } from '../../api/discovery'
import { createScoutPrompt, createScoutSignal, listScoutSources } from '../../api/scout'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { ScoutSourcesView } from './ScoutSourcesView'

const EMPTY_CAPTURE_FORM: Record<string, string> = {
  keyword: '', product_idea: '', heat_level: '',
  market: '', category: '', search_volume: '', trend_direction: '', growth_pct: '', competition_level: '',
  platform: '', name: '', price_min: '', price_max: '', sales_volume: '', sales_growth_rate: '', category_path: '',
}

const isTrendSource = (source: any) => source.signal_kind === 'trend_keyword'
const isPlatformSource = (source: any) => source.signal_kind === 'trending_product'
const isPromptSource = (source: any) => source.capture_mode === 'prompt'
const isImageSource = (source: any) => source.capture_mode === 'image'
const heatStyleByTone = (tone?: string) => {
  const safeTone = ['primary', 'warning', 'danger', 'success', 'info'].includes(tone || '') ? tone : 'muted'
  return {
    backgroundColor: safeTone === 'muted' ? 'var(--color-bg)' : `var(--color-${safeTone}-light)`,
    color: safeTone === 'muted' ? 'var(--color-muted)' : `var(--color-${safeTone})`,
  }
}

export default function ScoutSourcesPage() {
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [showCapture, setShowCapture] = useState<string | null>(null)
  const [captureForm, setCaptureForm] = useState(EMPTY_CAPTURE_FORM)
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([])
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [syncingTrends, setSyncingTrends] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')
  const [signalSources, setSignalSources] = useState<any[]>([])
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const [dict, setDict] = useState<{
    markets: any[]
    categories: any[]
    platforms: any[]
    trend_directions?: any[]
    competition_levels?: any[]
    signal_heat_levels?: any[]
  } | null>(null)

  useEffect(() => {
    getDictionary()
      .then(r => r.data && setDict(r.data))
      .catch((e: any) => logger.error('Dictionary load failed', e))
  }, [])
  const [trendKeywords, setTrendKeywords] = useState<any[]>([])
  const [addingKeyword, setAddingKeyword] = useState<string | null>(null)

  const marketOptions = dict?.markets || []
  const categoryOptions = dict?.categories || []
  const platformOptions = filterPlatformsByCapability(dict?.platforms || [], 'competitor')
  const trendDirections = dict?.trend_directions || []
  const competitionLevels = dict?.competition_levels || []
  const signalHeatLevels = dict?.signal_heat_levels || []

  // Load sync status
  const loadSyncStatus = async () => {
    try {
      const res = await getTrendSyncStatus()
      setSyncStatus(res.data || null)
    } catch (e: any) { logger.error('Operation failed', e) }
  }

  const handleSyncTrends = async () => {
    setSyncingTrends(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const res = await fetchTrends()
      const result: any = res.data
      const msgs: string[] = []
      if (result?.google_trends) msgs.push(`Google Trends: ${result.google_trends}词`)
      if (result?.pinterest) msgs.push(`Pinterest: ${result.pinterest}词`)
      if (result?.cross_validated) msgs.push(`交叉验证: ${result.cross_validated}词`)
      if (result?.errors?.length) msgs.push(...result.errors)
      if (result?.message) msgs.push(result.message)
      if (res.status === 'data_required' && res.data_gaps?.length) msgs.push(`缺口：${res.data_gaps.join('、')}`)
      if (result?.next_actions?.length) msgs.push(`下一步：${result.next_actions.join('；')}`)
      if (msgs.length === 0) msgs.push('同步完成')
      setSyncMessage(msgs.join('；'))
      await loadTrendKeywords()
      await loadSyncStatus()
    } catch (e: any) {
      logger.error('Sync trends failed', e)
      setSyncError(e?.response?.data?.detail || e?.message || '网络错误')
    }
    setSyncingTrends(false)
  }

  const toggleMarket = (mkt: string) => {
    setSelectedMarkets(prev => prev.includes(mkt) ? prev.filter(m => m !== mkt) : [...prev, mkt])
  }

  // Load sync status on mount
  useEffect(() => { loadSyncStatus() }, [])

  const supplyFileRef = useRef<HTMLInputElement>(null)
  const [supplyPreview, setSupplyPreview] = useState<string | null>(null)
  const cultureFileRef = useRef<HTMLInputElement>(null)
  const cultureEditorRef = useRef<HTMLDivElement>(null)

  const uploadSupplyImage = async (file: File) => {
    // Set local preview immediately (like UploadTab does)
    setSupplyPreview(URL.createObjectURL(file))
    const form = new FormData()
    form.append('file', file)
    try {
      await uploadDiscoveryImage(form)
    } catch (e: any) {
      logger.error('Upload failed', e)
    }
  }

  const handleSupplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target?.files?.[0]
    if (f) uploadSupplyImage(f)
  }

  // Upload image for culture layer rich text editor
  const handleCultureImageUpload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('category', '')
    form.append('market', '')
    try {
      const res = await uploadDiscoveryImage(form)
      const imageUrl = res.data?.source_image
        ? `/api/v1/discovery/images/${res.data.source_image}`
        : null
      if (imageUrl && cultureEditorRef.current) {
        // Insert <img> at cursor position
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          // Restrict selection to our editor
          if (cultureEditorRef.current.contains(range.commonAncestorContainer)) {
            const img = document.createElement('img')
            img.src = imageUrl
            img.className = 'max-h-32 rounded-lg my-1'
            range.deleteContents()
            range.insertNode(img)
            // Move cursor after image
            range.setStartAfter(img)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
      }
    } catch (e: any) { logger.error('Operation failed', e) }
  }

  const handleCultureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target?.files?.[0]
    if (f) handleCultureImageUpload(f)
  }

  // Insert image into culture editor from paste or file picker
  const insertCultureImage = (file: File) => {
    handleCultureImageUpload(file)
  }

  // Global paste handler for supply-layer image upload
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      // Only handle paste when a supply capture card is open
      if (!document.querySelector('[data-supply-upload]')) return
      // Check if any of the pasted items is an image
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          uploadSupplyImage(file)
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])
  const [activeTab, setActiveTab] = useState<string>('culture')

  const layerTabs = Array.from(
    new Map(signalSources.map((source: any) => [
      source.layer,
      { id: source.layer, label: source.layer_label || source.layer, sortOrder: source.layer_sort_order || 99 },
    ])).values(),
  ).sort((a: any, b: any) => a.sortOrder - b.sortOrder)

  useEffect(() => {
    listScoutSources().then(r => {
      if (r.data) { setSignalSources(r.data as any[]); setSourcesError(null) }
    }).catch((e: any) => { logger.error('Load scout sources failed', e); setSourcesError('加载品源数据失败') })
  }, [])

  // Load trend keywords when trend layer is active
  const loadTrendKeywords = async () => {
    try {
      const params: Record<string, any> = {}
      if (selectedMarkets.length === 1) {
        params.market = selectedMarkets[0]
      }
      const res = await listTrends(params)
      const data: any = res.data
      if (data?.by_category) {
        // Flatten by_category into a list sorted by search_volume
        const items: any[] = []
        for (const cat of (data.categories || [])) {
          const markets = data.by_category[cat] || {}
          for (const market of Object.keys(markets)) {
            for (const kw of (markets[market] || [])) {
              items.push({ ...kw, category: cat, market })
            }
          }
        }
        items.sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
        setTrendKeywords(items)
      }
    } catch (e: any) { logger.error('Operation failed', e) }
  }

  useEffect(() => {
    if (activeTab === 'trend') {
      loadTrendKeywords()
    }
  }, [activeTab, selectedMarkets])

  const filteredSources = activeTab ? signalSources.filter((s: any) => s.layer === activeTab && s.id !== 'ai_mining') : signalSources.filter((s: any) => s.id !== 'ai_mining')

  const handleCapture = async (sourceId: string) => {
    const source = signalSources.find((item: any) => item.id === sourceId)
    if (!source) return
    if (source.capture_mode === 'image') {
      setSupplyPreview(null)
      setCaptureForm(EMPTY_CAPTURE_FORM)
      setShowCapture(null)
      return
    }
    const isTrend = source.signal_kind === 'trend_keyword'
    const isPlatform = source.signal_kind === 'trending_product'
    if (source.capture_mode === 'prompt') {
      const content = cultureEditorRef.current?.innerHTML || ''
      const textContent = cultureEditorRef.current?.textContent?.trim() || ''
      if (!textContent) return
      // First line as keyword for card title
      const firstLine = textContent.split('\n')[0].slice(0, 100)
      try {
        await createScoutPrompt({
          source_id: sourceId,
          keyword: firstLine,
          product_idea: content,
          heat_level: undefined })
        if (cultureEditorRef.current) cultureEditorRef.current.innerHTML = ''
        setCaptureForm(EMPTY_CAPTURE_FORM)
        setShowCapture(null)
      } catch (e: any) { logger.error('Operation failed', e) }
      return
    }
    if (!captureForm.keyword.trim() || !captureForm.product_idea.trim()) return
    try {
      await createScoutSignal({
        source_id: sourceId,
        keyword: captureForm.keyword.trim(),
        product_idea: captureForm.product_idea.trim(),
        heat_level: captureForm.heat_level === '' ? undefined : Number(captureForm.heat_level),
        // Trend keyword fields for trend-layer sources
        ...(isTrend ? {
          market: captureForm.market || undefined,
          category: captureForm.category || undefined,
          search_volume: captureForm.search_volume ? parseInt(captureForm.search_volume) : undefined,
          trend_direction: captureForm.trend_direction || undefined,
          growth_pct: captureForm.growth_pct ? parseFloat(captureForm.growth_pct) / 100 : undefined,
          competition_level: captureForm.competition_level || undefined } : {}),
        // Trending product fields for platform-layer sources
        ...(isPlatform ? {
          platform: captureForm.platform || undefined,
          product_name: captureForm.name || captureForm.keyword.trim(),
          price_min: captureForm.price_min ? parseFloat(captureForm.price_min) : undefined,
          price_max: captureForm.price_max ? parseFloat(captureForm.price_max) : undefined,
          sales_volume: captureForm.sales_volume ? parseInt(captureForm.sales_volume) : undefined,
          sales_growth_rate: captureForm.sales_growth_rate ? parseFloat(captureForm.sales_growth_rate) / 100 : undefined,
          category_path: captureForm.category_path || undefined,
          market: captureForm.market || undefined } : {}) })
      setCaptureForm(EMPTY_CAPTURE_FORM)
      setShowCapture(null)
    } catch (e: any) { logger.error('Operation failed', e) }
  }

  const getHeatInfo = (level: number) => {
    const levels = signalHeatLevels
      .map(item => ({ ...item, min: Number(item.min || 0) }))
      .sort((a, b) => a.min - b.min)
    const selected = levels.filter(item => level >= item.min).slice(-1)[0] || levels[0]
    return selected
      ? { label: selected.label, style: heatStyleByTone(selected.tone) }
      : { label: '未配置', style: heatStyleByTone('muted') }
  }
  const getLayerBtnText = (source: any) => {
    if (isTrendSource(source)) return '热搜关键词'
    if (isPlatformSource(source)) return '热门商品'
    if (isImageSource(source)) return '商品图片'
    return '潮流推荐'
  }
  const getLayerSubmitText = (source: any) => {
    if (isTrendSource(source)) return '添加热搜关键词'
    if (isPlatformSource(source)) return '添加热门商品'
    if (isImageSource(source)) return '上传商品图片'
    return '✅ 添加潮流推荐'
  }

  return <ScoutSourcesView {...{ layerTabs, signalSources, activeTab, setActiveTab, sourcesError, syncingTrends, syncStatus, syncMessage, syncError, handleSyncTrends, marketOptions, selectedMarkets, setSelectedMarkets, toggleMarket, trendKeywords, setTrendKeywords, addingKeyword, setAddingKeyword, filteredSources, expandedSource, setExpandedSource, isTrendSource, isPlatformSource, isPromptSource, isImageSource, showCapture, setShowCapture, captureForm, setCaptureForm, platformOptions, categoryOptions, trendDirections, competitionLevels, cultureEditorRef, cultureFileRef, handleCultureFileChange, insertCultureImage, supplyFileRef, supplyPreview, handleSupplyFileChange, handleCapture, getHeatInfo, getLayerSubmitText, getLayerBtnText, setSupplyPreview, EMPTY_CAPTURE_FORM }} />
}
