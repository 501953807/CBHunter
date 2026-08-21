import { useEffect, useState } from 'react'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import {
  deleteContentAsset,
  downloadContentAsset,
  editContentImage,
  editContentImageFromUrl,
  executeContentImageExportTasks,
  getContentAssets,
  getContentTaskMatrix,
  renderContentVideo,
  saveContentTaskVersion,
  confirmContentTaskVersion,
  type ContentAsset,
  type ContentWorkbenchItem,
} from '../../api/content'
import { logger } from '../../utils/logger'
import type { ApiResponse } from '../../types/common'
import { listListingTemplates } from '../../api/templates'
import {
  SellerImageEditorWorkbench,
  listingImageRoleByIndex,
  type ImageWatermarkTemplateOption,
  type ImageEditOptions,
  type MediaSlotPlan,
} from './SellerImageEditorWorkbench'
import { parseSavedImageSlotPlan } from './SellerImageSlotPlanParser'
import { isImageWatermarkTemplate, toImageWatermarkTemplateOption } from './SellerImageEditorUtils'
import {
  ContentAssetLibraryPanel,
  ImageProcessingPanel,
  ListingMediaSlotBoard,
  MediaProductContextPanel,
  MediaStudioSectionNav,
  VideoProcessingPanel,
} from './ContentMediaStudioParts'

export function ContentMediaStudio({ mode = 'all', product, initialSlotIndex = 1, onImageSlotPlanSaved }: {
  mode?: 'all' | 'image' | 'video'
  product?: ContentWorkbenchItem | null
  initialSlotIndex?: number
  onImageSlotPlanSaved?: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirmAction = useConfirm()
  const [assets, setAssets] = useState<ContentAsset[]>([])
  const [watermarkTemplates, setWatermarkTemplates] = useState<ImageWatermarkTemplateOption[]>([])
  const [savedSlotPlan, setSavedSlotPlan] = useState<MediaSlotPlan[] | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse<ContentAsset[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [imageOptions, setImageOptions] = useState<ImageEditOptions>({
    width: 1080, height: 1080, fit: 'contain', background: 'white',
    brightness: 1, contrast: 1, sharpness: 1, auto_contrast: true,
    unsharp_mask: true, crop_mode: 'none', crop_x: 0, crop_y: 0,
    crop_width: 800, crop_height: 800, watermark_text: '',
    rotate_degrees: 0, flip_horizontal: false, flip_vertical: false,
    watermark_position: 'bottom_right', watermark_opacity: 0.32,
    watermark_color: '#FFFFFF', output_format: 'jpeg', quality: 88,
  })
  const [videoOptions, setVideoOptions] = useState({
    width: 1080, height: 1920, fit: 'contain', background: 'white', seconds_per_image: 2,
  })

  const loadAssets = async () => {
    try {
      const response = await getContentAssets()
      setAssets(response.data || [])
      setEvidence(response)
    } catch (error: any) {
      logger.error('Load content assets failed', error)
      toast.addToast('error', '素材列表加载失败')
    }
  }

  const loadWatermarkTemplates = async () => {
    try {
      const response = await listListingTemplates(product?.target_platform || undefined)
      setWatermarkTemplates((response.data || []).filter(isImageWatermarkTemplate).map(toImageWatermarkTemplateOption))
    } catch (error: any) {
      logger.error('Load content image watermark templates failed', error)
      toast.addToast('error', '图片/水印模板加载失败')
    }
  }

  const loadSavedImageSlotPlan = async () => {
    if (!product?.id) {
      setSavedSlotPlan(null)
      return
    }
    try {
      const response = await getContentTaskMatrix(product.id)
      const imagePlanTask = (response.data?.tasks || []).find(task => task.task_type === 'image_edit_plan')
      setSavedSlotPlan(parseSavedImageSlotPlan(imagePlanTask?.latest_version?.content || ''))
    } catch (error: any) {
      logger.error('Load saved image slot plan failed', error)
      setSavedSlotPlan(null)
      toast.addToast('error', '已保存图片槽位计划加载失败')
    }
  }

  const notifyImageSlotPlanSaved = async () => {
    if (!onImageSlotPlanSaved) return
    try {
      await onImageSlotPlanSaved()
    } catch (error: any) {
      logger.error('Notify parent after image slot plan saved failed', error)
      toast.addToast('warning', '图片计划已保存，但当前商品上下文刷新失败，请重新打开该商品确认')
    }
  }

  useEffect(() => { loadAssets() }, [])
  useEffect(() => { loadWatermarkTemplates() }, [product?.target_platform])
  useEffect(() => { loadSavedImageSlotPlan() }, [product?.id])

  const applyWatermarkTemplate = (template: ImageWatermarkTemplateOption) => {
    setImageOptions(current => ({
      ...current,
      watermark_text: template.text,
      watermark_position: template.position,
      watermark_opacity: template.opacity,
      watermark_color: template.color,
    }))
    toast.addToast('success', `已应用水印模板：${template.name}`)
  }

  const clearWatermark = () => {
    setImageOptions(current => ({ ...current, watermark_text: '' }))
    toast.addToast('success', '已清除当前水印文字')
  }

  const runImageEdit = async () => {
    if (!imageFile) return
    setLoading(true)
    try {
      const response = await editContentImage(imageFile, {
        ...imageOptions,
        content_item_id: product?.id || '',
      })
      toast.addToast('success', `图片已处理：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
    } catch (error: any) {
      logger.error('Edit content image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '图片处理失败')
    } finally {
      setLoading(false)
    }
  }

  const uploadSlotImage = async (file: File) => {
    if (!product) {
      toast.addToast('warning', '请先选择要编辑的商品')
      return null
    }
    setLoading(true)
    try {
      const response = await editContentImage(file, {
        ...imageOptions,
        content_item_id: product.id,
      })
      toast.addToast('success', `已上传并处理当前槽位图片：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
      return response.data || null
    } catch (error: any) {
      logger.error('Upload listing slot image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '槽位图片上传失败')
      return null
    } finally {
      setLoading(false)
    }
  }

  const runSourceImageEdit = async () => {
    if (!product?.image_url) return null
    setLoading(true)
    try {
      const response = await editContentImageFromUrl({
        image_url: product.image_url,
        content_item_id: product.id,
        ...imageOptions,
      })
      toast.addToast('success', `已用商品源图生成素材：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
      return response.data || null
    } catch (error: any) {
      logger.error('Edit source image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '商品源图处理失败')
      return null
    } finally {
      setLoading(false)
    }
  }

  const saveImageSlotPlan = async (slots: MediaSlotPlan[]) => {
    if (!product) return
    setLoading(true)
    try {
      const publishImageLimit = product.media_readiness?.recommended_platform_images ?? 9
      const isPublishableSlot = (slot: MediaSlotPlan, index: number) => index === 0 || (typeof slot.publishable === 'boolean' ? slot.publishable : index + 1 <= publishImageLimit)
      const publishableImageCount = slots.filter((slot, index) => slot.imageUrl && isPublishableSlot(slot, index)).length
      const retainedImageCount = slots.filter((slot, index) => slot.imageUrl && !isPublishableSlot(slot, index)).length
      const imageExportTasks = slots
        .map((slot, index) => ({ slot, index, roleMeta: listingImageRoleByIndex(index), editOptions: slot.editOptions || imageOptions }))
        .filter(item => Boolean(item.slot.imageUrl))
        .map(({ slot, index, roleMeta, editOptions }) => ({
          task_id: `${product.id}-image-slot-${index + 1}`,
          position: index + 1,
          role: slot.role || roleMeta.role,
          label: slot.label || roleMeta.label,
          source_image_url: slot.imageUrl,
          asset_name: slot.assetName,
          scope: isPublishableSlot(slot, index) ? 'publish_image' : 'retained_asset',
          target_width: editOptions.width,
          target_height: editOptions.height,
          fit: editOptions.fit,
          crop_mode: editOptions.crop_mode,
          output_format: editOptions.output_format,
          quality: editOptions.quality,
          watermark_enabled: Boolean(editOptions.watermark_text),
          status: 'planned_not_exported',
          boundary: 'content_workbench_image_export_task',
        }))
      const payload = JSON.stringify({
        schema: 'listing_image_slots.v1',
        product_id: product.id,
        publish_image_limit: publishImageLimit,
        publishable_image_count: publishableImageCount,
        retained_image_count: retainedImageCount,
        export_task_schema: 'listing_image_export_tasks.v1',
        export_tasks: imageExportTasks,
        slots: slots.map((slot, index) => {
          const roleMeta = listingImageRoleByIndex(index)
          return {
            position: index + 1,
            role: slot.role || roleMeta.role,
            label: slot.label || roleMeta.label,
            image_url: slot.imageUrl,
            asset_name: slot.assetName,
            size: slot.sizeText,
            publishable: isPublishableSlot(slot, index),
            edit_options: slot.editOptions || imageOptions,
          }
        }),
        image_edit_options: imageOptions,
        boundary: 'content_workbench_image_plan',
      }, null, 2)
      const saved = await saveContentTaskVersion(product.id, 'image_edit_plan', payload, 'manual_image_slot_plan')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, 'image_edit_plan', version)
      setSavedSlotPlan(slots.map(slot => ({
        ...slot,
        exportStatus: 'planned_not_exported',
        exportError: undefined,
        generatedAssetUrl: undefined,
        exportedAt: undefined,
      })))
      await loadAssets()
      await notifyImageSlotPlanSaved()
      toast.addToast('success', '图片槽位顺序已保存到当前商品 Listing 图片计划')
    } catch (error: any) {
      logger.error('Save image slot plan failed', error)
      toast.addToast('error', error?.response?.data?.detail || '图片槽位保存失败')
    } finally {
      setLoading(false)
    }
  }

  const runSavedImageExportTasks = async () => {
    if (!product) {
      toast.addToast('warning', '请先选择要执行图片导出的商品')
      return
    }
    setLoading(true)
    try {
      const response = await executeContentImageExportTasks(product.id)
      const result = response.data
      if (!result?.executed) {
        toast.addToast('warning', result?.message || '当前没有成功导出的图片任务')
      } else {
        toast.addToast('success', `已导出 ${result.executed} 张图片素材${result.failed ? `，失败 ${result.failed} 项` : ''}`)
      }
      await loadAssets()
      await loadSavedImageSlotPlan()
      await notifyImageSlotPlanSaved()
    } catch (error: any) {
      logger.error('Execute saved image export tasks failed', error)
      toast.addToast('error', error?.response?.data?.detail || '图片导出任务执行失败')
    } finally {
      setLoading(false)
    }
  }

  const runVideoRender = async () => {
    if (videoFiles.length === 0) return
    setLoading(true)
    try {
      const response = await renderContentVideo(videoFiles, videoOptions)
      toast.addToast('success', `视频已生成：${response.data?.duration_seconds || 0} 秒`)
      await loadAssets()
    } catch (error: any) {
      logger.error('Render content video failed', error)
      toast.addToast('error', error?.response?.data?.detail || '视频生成失败')
    } finally {
      setLoading(false)
    }
  }

  const download = async (asset: ContentAsset) => {
    try {
      const blob = await downloadContentAsset(asset.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = asset.original_name || `content-${asset.id}.${asset.asset_type === 'video' ? 'mp4' : asset.mime_type.split('/')[1]}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      logger.error('Download content asset failed', error)
      toast.addToast('error', '素材下载失败')
    }
  }

  const remove = async (asset: ContentAsset) => {
    const ok = await confirmAction({
      title: '删除内容素材',
      message: `确认删除素材「${asset.original_name || asset.id}」？删除后该图片/视频不能继续用于当前 Listing 内容制作。`,
      confirmText: '确认删除素材',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteContentAsset(asset.id)
      setAssets(current => current.filter(item => item.id !== asset.id))
      toast.addToast('success', '素材已删除')
    } catch (error: any) {
      logger.error('Delete content asset failed', error)
      toast.addToast('error', '素材删除失败')
    }
  }

  const productAssets = product ? assets.filter(asset => String(asset.extra?.content_item_id || '') === product.id) : []
  const productImageAssets = productAssets.filter(asset => asset.asset_type === 'image')
  const productVideoAssets = productAssets.filter(asset => asset.asset_type === 'video')
  const jumpTo = (id: string) => document.getElementById(`listing-media-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="space-y-4" data-ui="listing-media-editor-seller-console">
      <MediaStudioSectionNav onJump={jumpTo} />
      <SellerImageEditorWorkbench
        product={product || null}
        productImageAssets={productImageAssets}
        imageOptions={imageOptions}
        setImageOptions={setImageOptions}
        onUseSourceImage={runSourceImageEdit}
        onUploadSlotImage={uploadSlotImage}
        onSaveImageSlotPlan={saveImageSlotPlan}
        loading={loading}
        initialSlotIndex={initialSlotIndex}
        initialSavedSlotPlan={savedSlotPlan}
        watermarkTemplates={watermarkTemplates}
        onApplyWatermarkTemplate={applyWatermarkTemplate}
        onClearWatermark={clearWatermark}
      />
      <ListingMediaSlotBoard product={product || null} productImageAssets={productImageAssets} productVideoAssets={productVideoAssets} onUseSourceImage={runSourceImageEdit} loading={loading} />

      <MediaProductContextPanel product={product || null} loading={loading} onRunSavedImageExportTasks={runSavedImageExportTasks} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {mode !== 'video' && (
          <ImageProcessingPanel
            product={product || null}
            loading={loading}
            imageFile={imageFile}
            imageOptions={imageOptions}
            watermarkTemplates={watermarkTemplates}
            onImageFileChange={setImageFile}
            onImageOptionsChange={setImageOptions}
            onApplyWatermarkTemplate={applyWatermarkTemplate}
            onClearWatermark={clearWatermark}
            onRunSourceImageEdit={runSourceImageEdit}
            onRunImageEdit={runImageEdit}
          />
        )}

        {mode !== 'image' && (
          <VideoProcessingPanel
            videoFiles={videoFiles}
            videoOptions={videoOptions}
            loading={loading}
            onVideoFilesChange={setVideoFiles}
            onVideoOptionsChange={setVideoOptions}
            onRunVideoRender={runVideoRender}
          />
        )}
      </div>

      <ContentAssetLibraryPanel assets={assets} evidence={evidence} onRefresh={loadAssets} onDownload={download} onRemove={remove} />
    </div>
  )
}
