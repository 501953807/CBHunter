import client from './client'
import type { ApiResponse } from '../types/common'

export interface ListingTemplate {
  id: string
  name: string
  description?: string | null
  platform: string
  category_id?: string | null
  template_data: {
    title_template?: string
    description_template?: string
    [key: string]: unknown
  }
  is_default: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface ListingTemplateInput {
  name: string
  description?: string
  platform: string
  category_id?: string | null
  template_data: ListingTemplate['template_data']
  is_default: boolean
}

export interface ListingTemplatePreview {
  template_name: string
  platform: string
  product_name: string
  resolved_data: Record<string, unknown>
}

export async function listListingTemplates(platform?: string) {
  const res = await client.get<ApiResponse<ListingTemplate[]>>('/templates', { params: platform ? { platform } : {} })
  return res.data
}

export async function createListingTemplate(data: ListingTemplateInput) {
  const res = await client.post<ApiResponse<ListingTemplate>>('/templates', data)
  return res.data
}

export async function updateListingTemplate(id: string, data: Partial<ListingTemplateInput>) {
  const res = await client.put<ApiResponse<ListingTemplate>>(`/templates/${id}`, data)
  return res.data
}

export async function deleteListingTemplate(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/templates/${id}`)
  return res.data
}

export async function previewListingTemplate(templateId: string, productId: string) {
  const res = await client.post<ApiResponse<ListingTemplatePreview>>('/templates/preview', {
    template_id: templateId,
    product_id: productId,
  })
  return res.data
}
