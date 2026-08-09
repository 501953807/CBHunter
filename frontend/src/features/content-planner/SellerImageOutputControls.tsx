import type { Dispatch, SetStateAction } from 'react'
import type { ImageEditOptions } from './SellerImageEditorWorkbench'

export function SellerImageOutputControls({ imageOptions, setImageOptions, inputClass }: {
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  inputClass: string
}) {
  const setQuality = (quality: number) => setImageOptions(prev => ({ ...prev, quality: Math.min(100, Math.max(40, Number(quality) || prev.quality)) }))
  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-output-format-controls" aria-label="图片输出格式与质量控制">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">输出格式</p>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{imageOptions.output_format.toUpperCase()} · Q{imageOptions.quality}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-[var(--color-muted)]">格式<select className={`${inputClass} mt-1 w-full py-1 text-[11px]`} value={imageOptions.output_format} onChange={event => setImageOptions(prev => ({ ...prev, output_format: event.target.value }))}><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option></select></label>
        <label className="text-[10px] text-[var(--color-muted)]">质量<input className={`${inputClass} mt-1 w-full py-1 text-[11px]`} type="number" min="40" max="100" step="1" value={imageOptions.quality} onChange={event => setQuality(Number(event.target.value))} disabled={imageOptions.output_format === 'png'} /></label>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--color-muted)]">JPEG/WebP 使用质量参数；PNG以无损输出为主。该配置随当前图片槽位保存。</p>
    </div>
  )
}
