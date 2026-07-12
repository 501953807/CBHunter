export function PromptCapture({ cultureEditorRef, cultureFileRef, handleCultureFileChange, insertCultureImage, handleCapture }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-[var(--color-accent)]">潮流推荐内容</span>
        <span className="text-[11px] text-[var(--color-muted)]">支持文字和图片（粘贴或上传）</span>
        <button type="button" onClick={() => cultureFileRef.current?.click()}
          className="ml-auto text-[11px] text-[var(--color-accent)] hover:text-[var(--color-accent)] border border-dashed border-[var(--color-accent)] rounded px-2 py-0.5">
          + 添加图片
        </button>
      </div>
      <div
        ref={cultureEditorRef}
        contentEditable
        suppressContentEditableWarning
        className="w-full text-xs border border-[var(--color-accent)] rounded-lg px-2.5 py-2 focus:border-[var(--color-accent)] outline-none min-h-[120px] leading-relaxed [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-[var(--color-muted)]"
        data-placeholder="输入潮流推荐详情... 支持粘贴图片 (Ctrl+V)"
        onPaste={(event) => {
          const items = event.clipboardData?.items
          if (!items) return
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) insertCultureImage(file)
              break
            }
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            handleCapture()
          }
        }}
      />
      <input ref={cultureFileRef} type="file" accept="image/*" className="hidden" onChange={handleCultureFileChange} />
      <p className="text-[11px] text-[var(--color-muted)]">按 Ctrl+Enter 快速提交</p>
    </div>
  )
}

export function BasicCaptureInputs({ captureForm, setCaptureForm }: any) {
  return (
    <>
      <input type="text" placeholder="* 核心关键词（如: 韩系尼龙饺子包）" className="w-full text-xs border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 focus:border-[var(--color-primary)] outline-none" value={captureForm.keyword} onChange={e => setCaptureForm({ ...captureForm, keyword: e.target.value })} autoFocus />
      <input type="text" placeholder="* 产品灵感（一句话描述）" className="w-full text-xs border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 focus:border-[var(--color-primary)] outline-none" value={captureForm.product_idea} onChange={e => setCaptureForm({ ...captureForm, product_idea: e.target.value })} />
    </>
  )
}

export function PlatformCaptureFields({ captureForm, setCaptureForm, platformOptions, marketOptions, categoryOptions }: any) {
  return (
    <>
      <div className="pt-1 border-t border-[var(--color-primary)] space-y-2">
        <p className="text-[11px] font-medium text-[var(--color-warning)]">📦 热卖商品信息</p>
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="目标平台" value={captureForm.platform} onChange={(value: string) => setCaptureForm({ ...captureForm, platform: value })} options={platformOptions} color="warning" empty="选择平台" />
          <SelectField label="目标市场" value={captureForm.market} onChange={(value: string) => setCaptureForm({ ...captureForm, market: value })} options={marketOptions} color="warning" empty="选择市场" withFlag />
        </div>
        <input type="text" placeholder="* 商品名称" className="w-full text-[11px] border border-[var(--color-warning)] rounded px-2 py-1.5 outline-none" value={captureForm.name} onChange={e => setCaptureForm({ ...captureForm, name: e.target.value })} />
        <div className="grid grid-cols-4 gap-2">
          {[
            ['price_min', '最低价', '0', 'number'],
            ['price_max', '最高价', '0', 'number'],
            ['sales_volume', '销量', '0', 'number'],
            ['sales_growth_rate', '增长率%', '0', 'number'],
          ].map(([key, label, placeholder, type]) => (
            <NumberField key={key} field={key} label={label} placeholder={placeholder} type={type} captureForm={captureForm} setCaptureForm={setCaptureForm} color="warning" />
          ))}
        </div>
        <SelectField label="商品分类" value={captureForm.category_path} onChange={(value: string) => setCaptureForm({ ...captureForm, category_path: value })} options={categoryOptions} color="warning" empty="选择分类" />
      </div>
      <p className="text-[11px] text-[var(--color-warning)]">平台层信号录入后将同步到「选品列表 → 热卖商品」</p>
    </>
  )
}

export function TrendCaptureFields({ captureForm, setCaptureForm, marketOptions, categoryOptions, trendDirections = [], competitionLevels = [] }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-primary)]">
        <SelectField label="目标市场" value={captureForm.market} onChange={(value: string) => setCaptureForm({ ...captureForm, market: value })} options={marketOptions} color="primary" empty="选择市场" withFlag />
        <SelectField label="品类" value={captureForm.category} onChange={(value: string) => setCaptureForm({ ...captureForm, category: value })} options={categoryOptions} color="primary" empty="选择品类" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField field="search_volume" label="搜索量" placeholder="0" type="number" captureForm={captureForm} setCaptureForm={setCaptureForm} color="primary" />
        <NumberField field="growth_pct" label="增长率%" placeholder="0" type="number" captureForm={captureForm} setCaptureForm={setCaptureForm} color="primary" />
        <div>
          <p className="text-[11px] text-[var(--color-primary)] mb-0.5">竞争度</p>
          <select className="w-full text-[11px] border border-[var(--color-primary)] rounded px-2 py-1.5 outline-none bg-[var(--color-surface)]" value={captureForm.competition_level} onChange={e => setCaptureForm({ ...captureForm, competition_level: e.target.value })}>
            <option value="">选择</option>
            {competitionLevels.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="text-[11px] text-[var(--color-primary)] mb-0.5">趋势方向</p>
        <div className="flex gap-1">
          {trendDirections.map((item: any) => (
            <button key={item.id} type="button" onClick={() => setCaptureForm({ ...captureForm, trend_direction: item.id })}
              className={`text-[11px] px-2 py-1 rounded border transition-all ${captureForm.trend_direction === item.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export function HeatSelector({ captureForm, setCaptureForm, getHeatInfo }: any) {
  const heatInfo = getHeatInfo(Number(captureForm.heat_level || 0))
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[var(--color-muted)]">热度:</span>
      <input type="range" min="0" max="100" className="flex-1 h-1.5" value={captureForm.heat_level === '' ? 0 : captureForm.heat_level} onChange={e => setCaptureForm({ ...captureForm, heat_level: e.target.value })} />
      <span className="text-[11px] px-1.5 py-0.5 rounded" style={heatInfo.style}>
        {captureForm.heat_level === '' ? '未填' : captureForm.heat_level} {heatInfo.label}
      </span>
    </div>
  )
}

export function CaptureSyncHint({ source, isTrendSource, isPlatformSource, isPromptSource }: any) {
  if (isTrendSource(source)) return <p className="text-[11px] text-[var(--color-primary)]">添加后将同步到「选品列表 → 趋势热点」</p>
  if (isPlatformSource(source)) return <p className="text-[11px] text-[var(--color-warning)]">添加后将同步到「选品列表 → 热卖商品」</p>
  if (isPromptSource(source)) return <p className="text-[11px] text-[var(--color-accent)]">添加后将同步到「选品列表 → 选品推荐」</p>
  return null
}

export function SupplyImageCapture({ supplyFileRef, supplyPreview, handleSupplyFileChange }: any) {
  return (
    <div className="pt-1 border-t border-[var(--color-success)]" data-supply-upload>
      <p className="text-[11px] font-medium text-[var(--color-success)] mb-1">📸 上传产品图片（支持粘贴）</p>
      <div className="border-2 border-dashed border-[var(--color-success)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--color-success)] transition-colors" onClick={() => supplyFileRef.current?.click()}>
        {supplyPreview ? (
          <img src={supplyPreview} className="max-h-28 mx-auto rounded-lg" />
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted)]">点击上传或粘贴图片 (Ctrl+V)</p>
            <p className="text-[11px] text-[var(--color-muted)] mt-1">上传后自动分析并加入图片选品待处理列表</p>
          </>
        )}
        <input ref={supplyFileRef} type="file" accept="image/*" className="hidden" onChange={handleSupplyFileChange} />
      </div>
      <p className="text-[11px] text-[var(--color-success)] mt-1">添加后将同步到「选品列表 → 图片选品」</p>
    </div>
  )
}

function SelectField({ label, value, onChange, options, color, empty, withFlag = false }: any) {
  const colorValue = `var(--color-${color})`
  return (
    <div>
      <p className="text-[11px] mb-0.5" style={{ color: colorValue }}>{label}</p>
      <select className="w-full text-[11px] border rounded px-2 py-1.5 outline-none bg-[var(--color-surface)]" style={{ borderColor: colorValue }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {options.map((item: any) => <option key={item.id} value={item.id}>{withFlag && item.flag ? `${item.flag} ${item.label}` : item.label}</option>)}
      </select>
    </div>
  )
}

function NumberField({ field, label, placeholder, type, captureForm, setCaptureForm, color }: any) {
  const colorValue = `var(--color-${color})`
  return (
    <div>
      <p className="text-[11px] mb-0.5" style={{ color: colorValue }}>{label}</p>
      <input type={type} step="0.01" className="w-full text-[11px] border rounded px-2 py-1.5 outline-none" style={{ borderColor: colorValue }} placeholder={placeholder} value={captureForm[field]} onChange={e => setCaptureForm({ ...captureForm, [field]: e.target.value })} />
    </div>
  )
}
