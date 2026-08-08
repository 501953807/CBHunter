import client from './client'
import type { ApiResponse } from '../types/common'
import type { ProductRecommendation } from '../types/recommender'

export interface PlatformListingRequirements {
  required_attributes?: string[]
  media?: string[]
  content?: string[]
  compliance?: string[]
  attribute_values?: Record<string, unknown>
  field_groups?: unknown[]
  object_model?: string[]
  evidence_source?: string
}

export interface MediaReadiness {
  captured_image_count?: number
  missing_image_count?: number
  min_platform_images?: number
  recommended_platform_images?: number
  publish_image_limit?: number | null
  retained_image_count?: number
  gaps?: string[]
  source?: string
}

export interface ContentBrief {
  bullets?: string[]
  image_plan?: string[]
  ai_assist?: string[]
  video_script?: string
  title?: string
}

export interface ConfirmedImageSlotPlan {
  images: string[]
  image_slots: Array<{ position?: number; role?: string; label?: string; image_url?: string; asset_name?: string; size?: string; publishable?: boolean }>
  publish_image_limit?: number | null
  publishable_image_count?: number
  retained_image_count?: number
}

export interface ContentWorkbenchItem {
  id: string
  work_item_id: string
  object_refs: ProductRecommendation['object_refs']
  product_name: string
  category?: string | null
  target_platform?: string | null
  target_market?: string | null
  image_url?: string | null
  media_readiness?: MediaReadiness
  confirmed_image_slot_plan?: ConfirmedImageSlotPlan
  platform_requirements?: PlatformListingRequirements
  content_brief?: ContentBrief
  lifecycle_status: string
  lifecycle_label: string
  evidence_completeness: ProductRecommendation['evidence_completeness']
  evidence_summary: ProductRecommendation['evidence_summary']
  source_price_rmb?: number | null
  selling_price_local?: number | null
  profit_margin_pct?: number | null
  content_status: 'not_started' | 'in_progress' | 'ready'
  content_gaps: string[]
  next_action: string
  next_action_route?: string
}

export interface ContentWorkbench {
  status: string
  metrics: { total: number; not_started: number; in_progress: number; ready: number }
  items: ContentWorkbenchItem[]
  data_gaps: string[]
  evidence_window: string
  confidence_reason: string
}

export interface ContentTaskVersion {
  version: number
  content: string
  provider: string
  status: string
  created_at: string
}

export interface ContentTaskItem {
  task_type: string
  label: string
  requires_ai: boolean
  status: 'not_started' | 'draft_ready' | 'confirmed'
  version_count: number
  confirmed_version: number | null
  latest_version: ContentTaskVersion | null
  confirmation_required: boolean
  required_for_pricing: boolean
}

export interface ContentTaskMatrix {
  work_item_id: string
  product_name: string
  target_platform?: string | null
  target_market?: string | null
  metrics: { total: number; confirmed: number; draft_ready: number; unconfirmed: number; required_total?: number; required_confirmed?: number }
  tasks: ContentTaskItem[]
  evidence_window: string
  confidence_reason: string
  next_action: string
  next_action_route: string
}

export interface TitleGenerateRequest {
  product_name: string
  features: string
  material: string
  scenes: string
  target_audience: string
  platform: string
  market: string
  content_item_id?: string
}

export interface FiveStepTitleGenerateRequest extends TitleGenerateRequest {
  category: string
}

export interface VideoContentPlanRequest {
  product_name: string
  category: string
  platform: string
  market: string
  features: string
  target_audience: string
  selling_points: string
  content_item_id?: string
}

export interface ContentAsset {
  id: string
  asset_type: 'image' | 'video'
  original_name?: string
  mime_type: string
  size_bytes: number
  width?: number
  height?: number
  duration_seconds?: number
  operation: string
  status: string
  extra: Record<string, unknown>
  created_at: string
}

export async function generateTitle(data: TitleGenerateRequest) {
  const res = await client.post<ApiResponse>('/content/generate-title', data)
  return res.data
}

export async function getContentWorkbench() {
  const res = await client.get<ApiResponse<ContentWorkbench>>('/content/workbench')
  return res.data
}

export async function getContentTaskMatrix(itemId: string) {
  const res = await client.get<ApiResponse<ContentTaskMatrix>>(`/content/workbench/${itemId}/tasks`)
  return res.data
}

export async function saveContentTaskVersion(itemId: string, taskType: string, content: string, provider = 'manual') {
  const res = await client.post<ApiResponse<{ task_type: string; version: number }>>(
    `/content/workbench/${itemId}/tasks/versions`,
    { task_type: taskType, content, provider },
  )
  return res.data
}

export async function confirmContentTaskVersion(itemId: string, taskType: string, version: number) {
  const res = await client.post<ApiResponse<ContentTaskMatrix>>(
    `/content/workbench/${itemId}/tasks/confirm`,
    { task_type: taskType, version },
  )
  return res.data
}

export async function generateContentTaskCandidate(itemId: string, data: {
  task_type: string
  product_name: string
  category?: string | null
  platform?: string | null
  market?: string | null
  features?: string
  selling_points?: string
  target_audience?: string
  source_url?: string
}) {
  const res = await client.post<ApiResponse<{
    task_type: string
    content: string
    provider: string
    confidence: string
    task_version: { task_type: string; version: number } | null
  }>>(`/content/workbench/${itemId}/tasks/generate`, data)
  return res.data
}

export async function generateTitlesFiveStep(data: FiveStepTitleGenerateRequest) {
  const res = await client.post<ApiResponse>('/content/generate-titles', data)
  return res.data
}

export async function generateVideoContentPlan(data: VideoContentPlanRequest) {
  const res = await client.post<ApiResponse>('/content/generate-video-plan', data)
  return res.data
}

export async function editContentImage(file: File, options: Record<string, string | number | boolean>) {
  const form = new FormData()
  form.append('file', file)
  Object.entries(options).forEach(([key, value]) => form.append(key, String(value)))
  const res = await client.post<ApiResponse<ContentAsset>>('/content/assets/image-edit', form)
  return res.data
}

export async function editContentImageFromUrl(data: Record<string, string | number | boolean | undefined | null>) {
  const res = await client.post<ApiResponse<ContentAsset>>('/content/assets/image-edit-url', data)
  return res.data
}

export async function renderContentVideo(files: File[], options: Record<string, string | number>) {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  Object.entries(options).forEach(([key, value]) => form.append(key, String(value)))
  const res = await client.post<ApiResponse<ContentAsset>>('/content/assets/video-render', form)
  return res.data
}

export async function getContentAssets() {
  const res = await client.get<ApiResponse<ContentAsset[]>>('/content/assets')
  return res.data
}

export async function downloadContentAsset(id: string) {
  const res = await client.get(`/content/assets/${id}/file`, { responseType: 'blob' })
  return res.data as Blob
}

export async function deleteContentAsset(id: string) {
  const res = await client.delete<ApiResponse>(`/content/assets/${id}`)
  return res.data
}
