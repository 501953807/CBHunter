export type ImageEditOptions = {
  width: number
  height: number
  fit: string
  background: string
  brightness: number
  contrast: number
  sharpness: number
  auto_contrast: boolean
  unsharp_mask: boolean
  crop_mode: string
  crop_x: number
  crop_y: number
  crop_width: number
  crop_height: number
  rotate_degrees: number
  flip_horizontal: boolean
  flip_vertical: boolean
  watermark_text: string
  watermark_position: string
  watermark_opacity: number
  watermark_color: string
  output_format: string
  quality: number
}

export type MediaSlotPlan = {
  index: number
  role: string
  label: string
  imageUrl: string
  assetName: string
  sizeText: string
  publishable?: boolean
  editOptions?: ImageEditOptions
  exportStatus?: string
  exportError?: string
  generatedAssetUrl?: string
  exportedAt?: string
}

export type ImageWatermarkTemplateOption = {
  id: string
  name: string
  platform: string
  scope: string
  text: string
  position: string
  opacity: number
  color: string
}
