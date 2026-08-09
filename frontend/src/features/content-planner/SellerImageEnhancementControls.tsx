import type { Dispatch, SetStateAction } from 'react'
import type { ImageEditOptions } from './SellerImageEditorWorkbench'

export function SellerImageEnhancementControls({ imageOptions, setImageOptions, inputClass }: {
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  inputClass: string
}) {
  const setRange = (key: keyof ImageEditOptions, value: number, min: number, max: number) => {
    setImageOptions(prev => ({ ...prev, [key]: Math.min(max, Math.max(min, Number(value) || Number(prev[key]))) }))
  }
  const toggleClass = (enabled: boolean) => enabled
    ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-1.5 text-[11px] font-semibold text-[var(--color-primary)]'
    : 'rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-enhancement-inline-controls" aria-label="图片增强与方向控制">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">增强与方向</p>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">B{imageOptions.brightness} · C{imageOptions.contrast} · S{imageOptions.sharpness}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RangeBox label="亮度" value={imageOptions.brightness} min={0.6} max={1.6} step={0.05} inputClass={inputClass} onChange={value => setRange('brightness', value, 0.6, 1.6)} />
        <RangeBox label="对比度" value={imageOptions.contrast} min={0.6} max={1.8} step={0.05} inputClass={inputClass} onChange={value => setRange('contrast', value, 0.6, 1.8)} />
        <RangeBox label="锐化" value={imageOptions.sharpness} min={0} max={4} step={0.25} inputClass={inputClass} onChange={value => setRange('sharpness', value, 0, 4)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2" data-ui="image-orientation-controls">
        <button type="button" className={toggleClass(imageOptions.auto_contrast)} onClick={() => setImageOptions(prev => ({ ...prev, auto_contrast: !prev.auto_contrast }))}>自动对比度</button>
        <button type="button" className={toggleClass(imageOptions.unsharp_mask)} onClick={() => setImageOptions(prev => ({ ...prev, unsharp_mask: !prev.unsharp_mask }))}>锐化蒙版</button>
        <button type="button" className={toggleClass(imageOptions.background === 'white')} onClick={() => setImageOptions(prev => ({ ...prev, background: prev.background === 'white' ? 'transparent' : 'white' }))}>白底输出</button>
        <button type="button" className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]" onClick={() => setImageOptions(prev => ({ ...prev, rotate_degrees: (prev.rotate_degrees + 90) % 360 }))}>旋转90°</button>
        <button type="button" className={toggleClass(imageOptions.flip_horizontal)} onClick={() => setImageOptions(prev => ({ ...prev, flip_horizontal: !prev.flip_horizontal }))}>水平翻转</button>
        <button type="button" className={toggleClass(imageOptions.flip_vertical)} onClick={() => setImageOptions(prev => ({ ...prev, flip_vertical: !prev.flip_vertical }))}>垂直翻转</button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--color-muted)]">增强、方向和白底参数随当前图片槽位保存；真实像素导出和平台审核仍由后续服务处理。</p>
    </div>
  )
}

function RangeBox({ label, value, min, max, step, inputClass, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  inputClass: string
  onChange: (value: number) => void
}) {
  return <label className="text-[10px] text-[var(--color-muted)]">{label}<input className={`${inputClass} mt-1 w-full py-1 text-[11px]`} type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>
}
