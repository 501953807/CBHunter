import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import {
  getPlatformFieldGroupVersions,
  publishPlatformFieldGroupDraft,
  savePlatformFieldGroupDraft,
} from '../../api/settings'
import { logger } from '../../utils/logger'
import {
  PLATFORM_LABELS,
  PlatformFieldGovernanceContent,
  PlatformFieldGovernanceHeader,
  buildCategoryProfileStats,
  buildPlatformSchemaStats,
  buildRuntimeImpactStats,
  type CategoryTreeSummary,
  type PlatformSchema,
} from './PlatformFieldGroupGovernanceParts'

export function PlatformFieldGroupGovernance() {
  const [searchParams] = useSearchParams()
  const [activeSchema, setActiveSchema] = useState<Record<string, PlatformSchema>>({})
  const [draftSchema, setDraftSchema] = useState<Record<string, PlatformSchema> | null>(null)
  const [editableSchema, setEditableSchema] = useState<Record<string, PlatformSchema>>({})
  const [historyCount, setHistoryCount] = useState(0)
  const [activePlatform, setActivePlatform] = useState('shopee')
  const [changeNote, setChangeNote] = useState('')
  const [statusText, setStatusText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [categoryTreeSummary, setCategoryTreeSummary] = useState<CategoryTreeSummary | null>(null)

  const platformKeys = useMemo(() => (
    Object.keys(editableSchema).filter(key => PLATFORM_LABELS[key])
  ), [editableSchema])
  const currentSchema = editableSchema[activePlatform] || {}
  const rawActiveVersion = (activeSchema as Record<string, unknown>).version
  const rawDraftVersion = draftSchema ? (draftSchema as Record<string, unknown>).version : ''
  const activeVersion = typeof rawActiveVersion === 'string' && rawActiveVersion ? rawActiveVersion : 'default'
  const draftVersion = typeof rawDraftVersion === 'string' ? rawDraftVersion : ''
  const fieldPackageStats = useMemo(() => (
    platformKeys.map(platform => ({ platform, ...buildPlatformSchemaStats(editableSchema[platform]) }))
  ), [platformKeys, editableSchema])
  const runtimeImpactStats = useMemo(() => (
    platformKeys.map(platform => ({ platform, ...buildRuntimeImpactStats(activeSchema[platform], editableSchema[platform]) }))
  ), [platformKeys, activeSchema, editableSchema])
  const categoryProfileStats = useMemo(() => (
    platformKeys.map(platform => ({ platform, ...buildCategoryProfileStats(editableSchema[platform]) }))
  ), [platformKeys, editableSchema])
  const currentStats = { platform: activePlatform, ...buildPlatformSchemaStats(currentSchema) }
  const currentRuntimeImpact = { platform: activePlatform, ...buildRuntimeImpactStats(activeSchema[activePlatform], currentSchema) }
  const currentCategoryStats = { platform: activePlatform, ...buildCategoryProfileStats(currentSchema) }
  const focusTarget = searchParams.get('focus') || ''
  const focusProfile = searchParams.get('profile') || ''
  const focusCategory = searchParams.get('category') || ''
  const fromRuntimeFieldEditor = focusTarget === 'platform_field_groups'

  const loadVersions = async () => {
    setLoading(true)
    try {
      const response = await getPlatformFieldGroupVersions()
      const active = (response.data?.active || {}) as Record<string, PlatformSchema>
      const draft = response.data?.draft && Object.keys(response.data.draft).length
        ? response.data.draft as Record<string, PlatformSchema>
        : null
      setActiveSchema(active)
      setDraftSchema(draft)
      setEditableSchema(draft || active)
      setHistoryCount(response.data?.history?.length || 0)
      setCategoryTreeSummary((response.data?.category_tree_summary || null) as CategoryTreeSummary | null)
      setDirty(false)
      setStatusText(draft ? `已加载平台字段组草稿 ${(draft as Record<string, unknown>).version || ''}` : '当前无草稿，正在编辑生效版副本')
      const firstPlatform = Object.keys(draft || active).find(key => PLATFORM_LABELS[key])
      if (firstPlatform) setActivePlatform(current => PLATFORM_LABELS[current] ? current : firstPlatform)
      if (focusProfile || focusCategory) {
        const focusedPlatform = Object.keys(draft || active).find(platform => {
          const schema = (draft || active)[platform]
          return (schema?.category_profiles || []).some(profile => (
            (focusProfile && profile.id === focusProfile)
            || (focusProfile && profile.label === focusProfile)
            || (focusCategory && (profile.match || []).includes(focusCategory))
          ))
        })
        if (focusedPlatform) setActivePlatform(focusedPlatform)
      }
    } catch (e: any) {
      logger.error('Load platform field group versions failed', e)
      setStatusText('平台字段组版本加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVersions()
  }, [])

  const updateField = (groupIndex: number, fieldIndex: number, fieldPatch: Record<string, unknown>) => {
    setEditableSchema(current => {
      const next = structuredClone(current)
      const groups = next[activePlatform]?.groups || []
      const field = groups[groupIndex]?.fields?.[fieldIndex]
      if (field) Object.assign(field, fieldPatch)
      return next
    })
    setDirty(true)
  }

  const saveDraft = async () => {
    setSaving(true)
    try {
      await savePlatformFieldGroupDraft(editableSchema, changeNote || '设置中心保存平台字段组草稿')
      setStatusText('平台字段组草稿已保存，尚未影响运行时字段渲染')
      setChangeNote('')
      await loadVersions()
    } catch (e: any) {
      logger.error('Save platform field group draft failed', e)
      setStatusText('保存失败：请检查平台、字段组、字段 key 和中文名是否完整且不重复')
    } finally {
      setSaving(false)
    }
  }

  const publishDraft = async () => {
    if (dirty) {
      setStatusText('当前有未保存修改，请先保存草稿后再发布')
      return
    }
    setSaving(true)
    try {
      await publishPlatformFieldGroupDraft(draftVersion)
      setStatusText('平台字段组草稿已发布为生效版，后续动态字段渲染将读取新 Schema')
      await loadVersions()
    } catch (e: any) {
      logger.error('Publish platform field group draft failed', e)
      setStatusText('发布失败：没有可发布草稿或草稿版本已过期')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card data-ui="settings-platform-field-group-approval">
      <PlatformFieldGovernanceHeader
        activeVersion={activeVersion}
        draftVersion={draftVersion}
        dirty={dirty}
        historyCount={historyCount}
        loading={loading}
        onRefresh={loadVersions}
      />
      <PlatformFieldGovernanceContent
        activePlatform={activePlatform}
        categoryProfileStats={categoryProfileStats}
        categoryTreeSummary={categoryTreeSummary}
        changeNote={changeNote}
        currentCategoryStats={currentCategoryStats}
        currentRuntimeImpact={currentRuntimeImpact}
        currentSchema={currentSchema}
        currentStats={currentStats}
        dirty={dirty}
        draftVersion={draftVersion}
        fieldPackageStats={fieldPackageStats}
        focusCategory={focusCategory}
        focusProfile={focusProfile}
        fromRuntimeFieldEditor={fromRuntimeFieldEditor}
        onChangeNote={setChangeNote}
        onPlatformSelect={setActivePlatform}
        onPublishDraft={publishDraft}
        onSaveDraft={saveDraft}
        onUpdateField={updateField}
        platformKeys={platformKeys}
        runtimeImpactStats={runtimeImpactStats}
        saving={saving}
        statusText={statusText}
      />
    </Card>
  )
}
