import { useState } from 'react'
import { importProductImageUrl, uploadProductImage } from '../../api/products'
import { logger } from '../../utils/logger'

interface Props {
  productId?: string
  imageText: string
  onChange: (value: string) => void
}

export function ProductImagesPanel({ productId, imageText, onChange }: Props) {
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const images = imageText.split('\n').map(item => item.trim()).filter(Boolean)
  const updateImages = (next: string[]) => onChange(next.join('\n'))
  const appendImageUrl = (url: string) => {
    if (!url) return
    updateImages(images.includes(url) ? images : [...images, url])
  }
  const upload = async (file?: File) => {
    if (!productId || !file) return
    setSaving(true)
    setMessage('')
    try {
      const result = await uploadProductImage(productId, file)
      if (result.data?.image_url) appendImageUrl(result.data.image_url)
      setMessage('上传商品图片完成，素材入库后自动写入图片列表。')
    } catch (e: any) {
      logger.error('Upload product image failed', e)
      setMessage(e?.response?.data?.error?.message || e?.message || '上传商品图片失败')
    } finally {
      setSaving(false)
    }
  }
  const importUrl = async () => {
    if (!productId || !sourceUrl.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const result = await importProductImageUrl(productId, sourceUrl.trim())
      if (result.data?.image_url) appendImageUrl(result.data.image_url)
      setSourceUrl('')
      setMessage('采集图片入库完成，素材入库后自动写入图片列表。')
    } catch (e: any) {
      logger.error('Import product image URL failed', e)
      setMessage(e?.response?.data?.error?.message || e?.message || '采集图片入库失败')
    } finally {
      setSaving(false)
    }
  }
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= images.length) return
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    updateImages(next)
  }
  const remove = (index: number) => updateImages(images.filter((_, i) => i !== index))
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">上传商品图片</label>
            <input
              type="file"
              accept="image/*"
              disabled={!productId || saving}
              onChange={event => upload(event.target.files?.[0])}
              className="block text-sm text-[var(--color-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:text-[var(--color-bg)] disabled:opacity-60"
            />
          </div>
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">采集图片入库</label>
            <input
              value={sourceUrl}
              disabled={!productId || saving}
              onChange={event => setSourceUrl(event.target.value)}
              placeholder="粘贴真实商品图片 URL"
              className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={!productId || saving || !sourceUrl.trim()}
            onClick={importUrl}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '处理中...' : '采集图片入库'}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">素材入库后自动写入图片列表；新建商品需先保存商品主档后再上传或采集图片。</p>
        {message && <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">{message}</p>}
      </div>
      <div className="max-w-2xl">
        <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">图片 URL（每行一个）</label>
        <textarea
          value={imageText}
          onChange={event => onChange(event.target.value)}
          rows={8}
          className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none"
        />
        <p className="mt-2 text-xs text-[var(--color-muted)]">只保存用户提供或采集到的真实素材地址，不生成占位图片。</p>
        <p className="mt-1 text-xs" style={{ color: images.length < 5 ? 'var(--color-warning)' : 'var(--color-muted)' }}>
          平台图片规则：至少 5 张，建议 9 张；第一张作为主图，其余作为辅图。当前 {images.length} 张。
        </p>
      </div>
      {images.length > 0 && (
        <div aria-label="商品图片真实预览" className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={index === 0 ? '主图预览' : '辅图预览'} className="aspect-square w-full rounded-lg object-cover bg-[var(--color-bg)]" />
              </a>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[11px] text-[var(--color-primary)]">{index === 0 ? '主图' : `辅图 ${index}`}</span>
                <span className="text-[11px] text-[var(--color-muted)]">{index + 1}/9</span>
              </div>
              <p className="mt-2 truncate text-[11px] text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">{url}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-fg)] disabled:text-[var(--color-muted)]">上移</button>
                <button type="button" disabled={index === images.length - 1} onClick={() => move(index, 1)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-fg)] disabled:text-[var(--color-muted)]">下移</button>
                <button type="button" aria-label="删除图片" onClick={() => remove(index)} className="rounded border border-[var(--color-danger)] px-2 py-1 text-[11px] text-[var(--color-danger)]">删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
