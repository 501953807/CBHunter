import { BookOpen, Check, Edit3, Plus, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import type { DictionaryAdminConfig, DictionaryDefinition } from '../../api/settings'
import SeedManagerTab from './SeedManagerTab'

type DictionaryTab = { key: string; label: string; items: any[] }

export function DictionarySettingsCard({
  active,
  activeDict,
  adding,
  addForm,
  definitions,
  editingId,
  editForm,
  evidence,
  fieldLabel,
  fields,
  getTabCount,
  onAdd,
  onAddFormChange,
  onCancelAdd,
  onCancelEdit,
  onDelete,
  onEditFormChange,
  onSave,
  onSelectDict,
  onStartAdd,
  onStartEdit,
  toast,
}: {
  active: DictionaryTab
  activeDict: string
  adding: boolean
  addForm: Record<string, string>
  definitions: DictionaryDefinition[]
  editingId: string | null
  editForm: Record<string, string>
  evidence: ApiResponse<DictionaryAdminConfig> | null
  fieldLabel: (key: string) => string
  fields: string[]
  getTabCount: (tabId: string) => number
  onAdd: () => void
  onAddFormChange: (field: string, value: string) => void
  onCancelAdd: () => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onEditFormChange: (field: string, value: string) => void
  onSave: () => void
  onSelectDict: (id: string) => void
  onStartAdd: () => void
  onStartEdit: (item: any) => void
  toast: any
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">业务字典</h2>
          </div>
          {activeDict !== 'seeds' && !adding && (
            <button
              onClick={onStartAdd}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[var(--color-primary-text)]"
              style={{ background: 'var(--gradient-accent)' }}
            >
              <Plus className="h-3 w-3" /> 新增
            </button>
          )}
        </div>
        <DictionaryTabs
          activeDict={activeDict}
          definitions={definitions}
          getTabCount={getTabCount}
          onSelectDict={onSelectDict}
        />
      </CardHeader>
      <EvidenceBanner evidence={evidence} compact />
      {activeDict === 'seeds' ? (
        <CardContent><SeedManagerTab toast={toast} /></CardContent>
      ) : (
        <CardContent>
          {adding && (
            <DictionaryAddForm
              addForm={addForm}
              fieldLabel={fieldLabel}
              fields={fields}
              onAdd={onAdd}
              onCancel={onCancelAdd}
              onFormChange={onAddFormChange}
            />
          )}
          <DictionaryItemsTable
            active={active}
            editingId={editingId}
            editForm={editForm}
            fieldLabel={fieldLabel}
            fields={fields}
            onCancelEdit={onCancelEdit}
            onDelete={onDelete}
            onEditFormChange={onEditFormChange}
            onSave={onSave}
            onStartEdit={onStartEdit}
          />
        </CardContent>
      )}
    </Card>
  )
}

function DictionaryTabs({
  activeDict,
  definitions,
  getTabCount,
  onSelectDict,
}: {
  activeDict: string
  definitions: DictionaryDefinition[]
  getTabCount: (tabId: string) => number
  onSelectDict: (id: string) => void
}) {
  return (
    <div className="mt-2 flex w-fit gap-1 rounded-lg bg-[var(--color-bg)] p-0.5">
      {definitions.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelectDict(tab.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${activeDict === tab.id ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-sm' : 'text-[var(--color-muted)]'}`}
        >
          {tab.label} ({getTabCount(tab.id)})
        </button>
      ))}
    </div>
  )
}

function DictionaryAddForm({
  addForm,
  fieldLabel,
  fields,
  onAdd,
  onCancel,
  onFormChange,
}: {
  addForm: Record<string, string>
  fieldLabel: (key: string) => string
  fields: string[]
  onAdd: () => void
  onCancel: () => void
  onFormChange: (field: string, value: string) => void
}) {
  return (
    <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-wrap items-end gap-2">
        {fields.map(field => (
          <div key={field}>
            <label className="mb-0.5 block text-[11px] text-[var(--color-muted)]">{fieldLabel(field)}</label>
            <input
              className="w-24 rounded border border-[var(--color-border)] px-2 py-1.5 text-xs"
              placeholder={fieldLabel(field)}
              value={addForm[field] || ''}
              onChange={event => onFormChange(field, event.target.value)}
            />
          </div>
        ))}
        <button onClick={onAdd} className="rounded bg-[var(--color-success)] px-3 py-1.5 text-xs text-[var(--color-primary-text)]">
          <Check className="mr-1 inline h-3 w-3" />添加
        </button>
        <button onClick={onCancel} className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs">
          取消
        </button>
      </div>
    </div>
  )
}

function DictionaryItemsTable({
  active,
  editingId,
  editForm,
  fieldLabel,
  fields,
  onCancelEdit,
  onDelete,
  onEditFormChange,
  onSave,
  onStartEdit,
}: {
  active: DictionaryTab
  editingId: string | null
  editForm: Record<string, string>
  fieldLabel: (key: string) => string
  fields: string[]
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onEditFormChange: (field: string, value: string) => void
  onSave: () => void
  onStartEdit: (item: any) => void
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[var(--color-border)]">
          {fields.map(field => (
            <th key={field} className="py-2 pr-3 text-left font-medium text-[var(--color-muted)]">{fieldLabel(field)}</th>
          ))}
          <th className="py-2 text-left font-medium text-[var(--color-muted)]">操作</th>
        </tr>
      </thead>
      <tbody>
        {active.items.map((item: any) => (
          <tr key={item.id} className="border-b border-[var(--color-border)]">
            {fields.map(field => (
              <td key={field} className="py-2 pr-3">
                {editingId === item.id ? (
                  <input
                    className="w-full rounded border border-[var(--color-border)] px-1.5 py-0.5 text-xs"
                    value={editForm[field] || ''}
                    onChange={event => onEditFormChange(field, event.target.value)}
                  />
                ) : (
                  <span className="text-[var(--color-fg)]">{item[field]}</span>
                )}
              </td>
            ))}
            <td className="flex gap-1 py-2">
              {editingId === item.id ? (
                <>
                  <button onClick={onSave} className="text-[var(--color-success)]"><Check className="h-3 w-3" /></button>
                  <button onClick={onCancelEdit} className="text-[var(--color-muted)]"><X className="h-3 w-3" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => onStartEdit(item)} className="text-[var(--color-primary)]"><Edit3 className="h-3 w-3" /></button>
                  <button onClick={() => onDelete(item.id)} className="text-[var(--color-danger)]"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
