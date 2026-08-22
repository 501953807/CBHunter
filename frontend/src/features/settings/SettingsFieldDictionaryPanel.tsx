import { BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import type { UnifiedFieldDictionaryItem } from '../../api/config'
import { PlatformFieldGroupGovernance } from './PlatformFieldGroupGovernance'
import { FieldDictionaryRow } from './SettingsDataPanelsParts'

export function SettingsFieldDictionaryPanel({
  activeFieldCount,
  activeVersion,
  changeNote,
  dirty,
  draftVersion,
  editingKey,
  fields,
  filteredFields,
  historyCount,
  loading,
  moduleFilter,
  modules,
  platformCoverage,
  query,
  saving,
  statusText,
  onCancelEdit,
  onChangeNoteChange,
  onModuleFilterChange,
  onPublishDraft,
  onQueryChange,
  onReload,
  onSaveDraft,
  onStartEdit,
  onUpdateField,
}: {
  activeFieldCount: number
  activeVersion: string
  changeNote: string
  dirty: boolean
  draftVersion: string
  editingKey: string | null
  fields: UnifiedFieldDictionaryItem[]
  filteredFields: UnifiedFieldDictionaryItem[]
  historyCount: number
  loading: boolean
  moduleFilter: string
  modules: string[]
  platformCoverage: Record<'shopee' | 'temu' | 'tiktok' | 'miaoshou', number>
  query: string
  saving: boolean
  statusText: string
  onCancelEdit: () => void
  onChangeNoteChange: (value: string) => void
  onModuleFilterChange: (value: string) => void
  onPublishDraft: () => void
  onQueryChange: (value: string) => void
  onReload: () => void
  onSaveDraft: () => void
  onStartEdit: (key: string) => void
  onUpdateField: (key: string, updater: (item: UnifiedFieldDictionaryItem) => UnifiedFieldDictionaryItem) => void
}) {
  return (
    <div className="space-y-4">
      <Card data-ui="settings-unified-field-dictionary">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
                <h2 className="font-semibold text-[var(--color-fg)]">统一字段字典</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                通过生效版、草稿和历史版本治理标准字段、数据类型、所属模块、三平台字段和妙手参考字段；草稿不影响运行时字段映射，发布后才进入全系统配置。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                字段 {fields.length}
              </span>
              <button
                onClick={onReload}
                disabled={loading}
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-fg)] disabled:opacity-50"
              >
                {loading ? '加载中' : '刷新版本'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {[
              ['Shopee', platformCoverage.shopee],
              ['TEMU', platformCoverage.temu],
              ['TikTok', platformCoverage.tiktok],
              ['妙手参考', platformCoverage.miaoshou],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-[11px] text-[var(--color-muted)]">{label as string}</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-fg)]">{value as number}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-3" data-ui="settings-field-dictionary-version-governance">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[var(--color-muted)]">生效版</p>
              <p className="mt-1 font-semibold text-[var(--color-fg)]">{activeVersion} · {activeFieldCount} 字段</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[var(--color-muted)]">草稿</p>
              <p className="mt-1 font-semibold text-[var(--color-fg)]">{draftVersion || '无草稿'} {dirty ? '· 未保存' : ''}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[var(--color-muted)]">历史版本</p>
              <p className="mt-1 font-semibold text-[var(--color-fg)]">{historyCount} 个归档</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="搜索标准字段、中文名、平台字段或妙手字段"
              className="min-w-[260px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
            />
            <select
              value={moduleFilter}
              onChange={event => onModuleFilterChange(event.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="all">全部模块</option>
              {modules.map(module => <option key={module} value={module}>{module}</option>)}
            </select>
            <input
              value={changeNote}
              onChange={event => onChangeNoteChange(event.target.value)}
              placeholder="变更说明，例如：补齐 Shopee 越南字段"
              className="min-w-[260px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
            />
            <button
              onClick={onSaveDraft}
              disabled={saving || fields.length === 0}
              className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-text)] disabled:opacity-50"
            >
              保存草稿
            </button>
            <button
              onClick={onPublishDraft}
              disabled={saving || dirty || !draftVersion}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-fg)] disabled:opacity-50"
            >
              发布草稿
            </button>
          </div>
          {statusText ? (
            <p className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
              {statusText}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="sticky top-0 bg-[var(--color-bg)]">
                  <tr>
                    {['标准字段', '中文名', '类型', '模块', 'Shopee', 'TEMU', 'TikTok', '妙手参考', '国别差异', '操作'].map(head => (
                      <th key={head} className="border-b border-[var(--color-border)] px-3 py-2 text-left font-medium text-[var(--color-muted)]">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.map(item => (
                    <FieldDictionaryRow
                      key={item.key}
                      item={item}
                      editing={editingKey === item.key}
                      onEdit={() => onStartEdit(item.key)}
                      onCancel={onCancelEdit}
                      onChange={updater => onUpdateField(item.key, updater)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {filteredFields.length === 0 ? (
              <p className="bg-[var(--color-surface)] px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                当前筛选没有字段；请调整关键词或模块。
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <PlatformFieldGroupGovernance />
    </div>
  )
}
