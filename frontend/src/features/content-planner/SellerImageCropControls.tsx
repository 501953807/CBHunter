import type { Dispatch, SetStateAction } from 'react'
import type { ImageEditOptions } from './SellerImageEditorWorkbench'

export function SellerImageCropControls({ imageOptions, setImageOptions, inputClass }: {
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  inputClass: string
}) {
  const setNumber = (key: keyof ImageEditOptions, value: number) => setImageOptions(prev => ({ ...prev, [key]: Number.isFinite(value) ? Math.max(0, value) : prev[key] }))
  return (
    <div className="image-workbench-control-card mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-crop-region-controls" aria-label="图片裁切区域控制">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">输出与裁切区域</p>
        <select className={`${inputClass} max-w-[112px] py-1 text-[11px]`} value={imageOptions.crop_mode} onChange={event => setImageOptions(prev => ({ ...prev, crop_mode: event.target.value }))}>
          <option value="none">不裁切</option>
          <option value="manual">手动裁切</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberBox label="宽度" value={imageOptions.width} onChange={value => setNumber('width', value)} inputClass={inputClass} />
        <NumberBox label="高度" value={imageOptions.height} onChange={value => setNumber('height', value)} inputClass={inputClass} />
        <NumberBox label="裁切X" value={imageOptions.crop_x} onChange={value => setNumber('crop_x', value)} inputClass={inputClass} disabled={imageOptions.crop_mode !== 'manual'} />
        <NumberBox label="裁切Y" value={imageOptions.crop_y} onChange={value => setNumber('crop_y', value)} inputClass={inputClass} disabled={imageOptions.crop_mode !== 'manual'} />
        <NumberBox label="裁切宽" value={imageOptions.crop_width} onChange={value => setNumber('crop_width', value)} inputClass={inputClass} disabled={imageOptions.crop_mode !== 'manual'} />
        <NumberBox label="裁切高" value={imageOptions.crop_height} onChange={value => setNumber('crop_height', value)} inputClass={inputClass} disabled={imageOptions.crop_mode !== 'manual'} />
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--color-muted)]">手动裁切参数会随当前图片槽位保存，切换槽位后回显该图自己的裁切区域。</p>
    </div>
  )
}

function NumberBox({ label, value, onChange, inputClass, disabled = false }: {
  label: string
  value: number
  onChange: (value: number) => void
  inputClass: string
  disabled?: boolean
}) {
  return <label className="text-[10px] text-[var(--color-muted)]">{label}<input className={`${inputClass} mt-1 w-full py-1 text-[11px] disabled:opacity-50`} type="number" min="0" value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} /></label>
}
