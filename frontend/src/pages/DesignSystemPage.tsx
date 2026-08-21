import { useState } from 'react'
import {
  mdiAccountCircleOutline,
  mdiAlertCircleOutline,
  mdiBellOutline,
  mdiCalendarBlankOutline,
  mdiCheckCircleOutline,
  mdiClose,
  mdiCogOutline,
  mdiDotsVertical,
  mdiDownloadOutline,
  mdiInformationOutline,
  mdiMagnify,
  mdiPencilOutline,
  mdiPlus,
  mdiRefresh,
  mdiStoreOutline,
  mdiUploadOutline,
} from '@mdi/js'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Checkbox } from '../components/ui/Checkbox'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { MdiIcon } from '../components/ui/MdiIcon'
import { Modal } from '../components/ui/Modal'
import { RadioGroup } from '../components/ui/RadioGroup'
import { Select } from '../components/ui/Select'
import { Switch } from '../components/ui/Switch'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/Toast'
import { DataTable, type Column } from '../components/shared/DataTable'
import { PageHeader } from '../components/shared/PageHeader'

interface DemoProductRow {
  id: string
  product: string
  platform: string
  shop: string
  status: string
  readiness: number
  updated: string
}

const demoRows: DemoProductRow[] = [
  { id: '1', product: 'CocoTrip 防水通勤胸包', platform: 'TikTok Shop', shop: 'SG 验证店铺', status: 'ready', readiness: 92, updated: '2026-08-13 20:10' },
  { id: '2', product: '可替换斜挎包肩带', platform: 'Shopee', shop: 'VN 验证店铺', status: 'warning', readiness: 68, updated: '2026-08-13 19:42' },
  { id: '3', product: '托特包毛毡内胆定型包', platform: 'TEMU', shop: 'MY 验证店铺', status: 'draft', readiness: 41, updated: '2026-08-13 18:55' },
]

const columns: Column<DemoProductRow>[] = [
  {
    key: 'product',
    header: '商品',
    sortable: true,
    render: row => (
      <div className="flex items-center gap-3">
        <span className="materio-avatar-cell">
          <MdiIcon path={mdiStoreOutline} size={0.82} />
        </span>
        <span>
          <span className="block font-semibold text-[var(--color-fg)]">{row.product}</span>
          <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{row.platform} / {row.shop}</span>
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    header: '状态',
    render: row => (
      <Badge variant={row.status === 'ready' ? 'success' : row.status === 'warning' ? 'warning' : 'outline'}>
        {row.status === 'ready' ? '发布就绪' : row.status === 'warning' ? '待补资料' : '草稿'}
      </Badge>
    ),
  },
  {
    key: 'readiness',
    header: '就绪度',
    sortable: true,
    render: row => (
      <div className="min-w-[160px]">
        <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
          <span>Listing completeness</span>
          <span>{row.readiness}%</span>
        </div>
        <div className="materio-progress">
          <span style={{ width: `${row.readiness}%` }} />
        </div>
      </div>
    ),
  },
  { key: 'updated', header: '更新时间' },
  {
    key: 'actions',
    header: '操作',
    render: () => (
      <div className="flex items-center gap-1">
        <button type="button" className="materio-icon-button" aria-label="编辑"><MdiIcon path={mdiPencilOutline} /></button>
        <button type="button" className="materio-icon-button" aria-label="更多"><MdiIcon path={mdiDotsVertical} /></button>
      </div>
    ),
  },
]

export default function DesignSystemPage() {
  return <DesignSystemContent />
}

function DesignSystemContent() {
  const [tab, setTab] = useState('overview')
  const [themeMode, setThemeMode] = useState('light')
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['1']))
  const toast = useToast()
  const openConfirm = useConfirm()

  return (
    <div className="materio-design-system-page space-y-6" data-ui="materio-design-system-page">
      <PageHeader
        title="Materio UI Kit 验收页"
        description="隐藏开发验收页：集中检查 CBHunter 全局组件在 light/dark/warm 主题下的颜色、圆角、阴影、密度、hover/focus/disabled/loading/open/selected/error 状态。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => toast.addToast('info', 'Snackbar / Toast 视觉状态已触发')}>
              <MdiIcon path={mdiBellOutline} /> Toast
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <MdiIcon path={mdiPlus} /> 打开 Dialog
            </Button>
          </div>
        }
      />

      <section className="materio-kit-grid">
        <Card>
          <CardHeader>
            <h2 className="materio-kit-title">Design Tokens</h2>
          </CardHeader>
          <CardContent>
            <div className="materio-token-grid">
              {[
                ['Primary', 'var(--color-primary)'],
                ['Success', 'var(--color-success)'],
                ['Warning', 'var(--color-warning)'],
                ['Danger', 'var(--color-danger)'],
                ['Info', 'var(--color-info)'],
                ['Surface', 'var(--color-surface)'],
              ].map(([label, token]) => (
                <div key={label} className="materio-token-card">
                  <span className="materio-token-swatch" style={{ background: token }} />
                  <span className="font-semibold text-[var(--color-fg)]">{label}</span>
                  <span className="text-xs text-[var(--color-muted)]">{token}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="materio-kit-title">Buttons</h2>
          </CardHeader>
          <CardContent>
            <div className="materio-kit-row">
              <Button><MdiIcon path={mdiUploadOutline} /> Primary</Button>
              <Button variant="secondary"><MdiIcon path={mdiDownloadOutline} /> Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="materio-kit-row mt-4">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <button type="button" className="materio-icon-button"><MdiIcon path={mdiRefresh} /></button>
              <button type="button" className="materio-icon-button" disabled><MdiIcon path={mdiCogOutline} /></button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="materio-kit-title">Form Controls</h2>
          </CardHeader>
          <CardContent>
            <div className="materio-form-demo-grid">
              <Input label="商品名称" placeholder="输入平台商品标题" defaultValue="CocoTrip Nylon Casual Chest Bag" />
              <Input label="错误状态" placeholder="必填字段" error="商品名称必须 25-255 字符" />
              <Select
                label="目标平台"
                value="shopee"
                options={[
                  { value: 'shopee', label: 'Shopee' },
                  { value: 'tiktok', label: 'TikTok Shop' },
                  { value: 'temu', label: 'TEMU' },
                ]}
              />
              <label className="materio-field-shell">
                <span>搜索框</span>
                <span className="materio-search-field">
                  <MdiIcon path={mdiMagnify} />
                  <input placeholder="搜索商品、SKU、店铺..." />
                </span>
              </label>
            </div>
            <div className="materio-kit-row mt-4">
              <Checkbox label="已选择" description="Checked 状态" defaultChecked />
              <Checkbox label="未选择" description="Unchecked 状态" />
              <RadioGroup
                name="kit-radio"
                value={themeMode}
                onChange={setThemeMode}
                orientation="horizontal"
                options={[
                  { value: 'light', label: '轻主题' },
                  { value: 'dark', label: '暗主题' },
                ]}
              />
              <Switch label="半暗菜单" description="Switch 状态" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="materio-kit-title">Tabs / Chips / Badges</h2>
          </CardHeader>
          <CardContent>
            <Tabs
              activeTab={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: 'Overview', count: 12 },
                { id: 'product', label: 'Product' },
                { id: 'order', label: 'Order', count: 3 },
              ]}
            />
            <div className="materio-kit-row mt-5">
              <Badge>Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="materio-kit-title">Data Table / Toolbar / Pagination</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">列表页必须只承载筛选、批量操作、表格、分页和行级操作。</p>
            </div>
            <div className="materio-kit-row">
              <Button variant="secondary"><MdiIcon path={mdiDownloadOutline} /> 导出</Button>
              <Button><MdiIcon path={mdiPlus} /> 新建</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="materio-toolbar mb-4">
            <Select
              value="all"
              options={[
                { value: 'all', label: '全部平台' },
                { value: 'shopee', label: 'Shopee' },
                { value: 'tiktok', label: 'TikTok Shop' },
              ]}
            />
            <Select
              value="all"
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'ready', label: '发布就绪' },
                { value: 'warning', label: '待补资料' },
              ]}
            />
            <span className="materio-search-field flex-1">
              <MdiIcon path={mdiMagnify} />
              <input placeholder="搜索商品、平台商品ID、SKU..." />
            </span>
          </div>
          <DataTable
            columns={columns}
            data={demoRows}
            keyField="id"
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            pagination={{ page: 1, page_size: 20, total: 63, total_pages: 4 }}
          />
        </CardContent>
      </Card>

      <section className="materio-kit-grid">
        <Card>
          <CardHeader>
            <h2 className="materio-kit-title">Dialog / Drawer</h2>
          </CardHeader>
          <CardContent>
            <div className="materio-kit-row">
              <Button onClick={() => setModalOpen(true)}>打开 Dialog</Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>打开右侧 Drawer</Button>
              <Button
                variant="danger"
                onClick={() => {
                  void openConfirm({
                    title: '确认删除模板',
                    message: '该动作只演示 ConfirmDialog 视觉状态，不会删除业务数据。',
                    tone: 'danger',
                  })
                }}
              >
                Confirm
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="materio-kit-title">Empty / Loading / Alert</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <EmptyState
              icon={<MdiIcon path={mdiInformationOutline} size={1.2} />}
              title="暂无平台回执"
              description="平台 Open API 未授权前只能显示本地草稿和待同步状态。"
              action={<Button variant="outline">去配置平台</Button>}
            />
            <div className="materio-alert tone-warning">
              <MdiIcon path={mdiAlertCircleOutline} />
              <span>这是警告态：用于数据缺口、字段待补、发布门禁未满足。</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Materio Dialog 示例"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
            <Button onClick={() => setModalOpen(false)}><MdiIcon path={mdiCheckCircleOutline} /> 确认</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="模板名称" defaultValue="Shopee 主图水印模板" />
          <Select
            label="应用范围"
            value="listing"
            options={[
              { value: 'listing', label: 'Listing 图片' },
              { value: 'promotion', label: '促销水印' },
            ]}
          />
        </div>
      </Modal>

      {drawerOpen && (
        <>
          <button type="button" className="materio-customizer-scrim" aria-label="关闭验收抽屉" onClick={() => setDrawerOpen(false)} />
          <aside className="materio-customizer-drawer" aria-label="Design system drawer">
            <div className="materio-customizer-header">
              <div>
                <h3>Right Drawer</h3>
                <p>用于业务流程、筛选详情、编辑辅助，不遮挡主页面结构。</p>
              </div>
              <button type="button" className="materio-icon-button" onClick={() => setDrawerOpen(false)} aria-label="关闭">
                <MdiIcon path={mdiClose} />
              </button>
            </div>
            <div className="materio-customizer-body space-y-4">
              <div className="materio-alert tone-info">
                <MdiIcon path={mdiInformationOutline} />
                <span>品源与选品、内容与刊登的流程悬浮菜单后续统一迁移到这种 Drawer 模式。</span>
              </div>
              <div className="materio-option-grid two">
                <button type="button" className="materio-preview-option" data-active="true">
                  <MdiIcon path={mdiCalendarBlankOutline} size={1.15} />
                  <span>Compact</span>
                </button>
                <button type="button" className="materio-preview-option">
                  <MdiIcon path={mdiAccountCircleOutline} size={1.15} />
                  <span>Profile</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
