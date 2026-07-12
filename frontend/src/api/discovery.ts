import client from './client'
import type { ApiResponse } from '../types/common'

export async function listTrendKeywords() {
  const res = await client.get<ApiResponse<{ items: any[] }>>('/discovery/trend-keywords')
  return res.data
}

export async function listTrends(params?: { consumed_only?: boolean }) {
  const res = await client.get<ApiResponse>('/discovery/trends', { params })
  return res.data
}

export async function aiRecommend(prompt: string) {
  const res = await client.post<ApiResponse<{ content: string }>>('/discovery/recommend', { prompt })
  return res.data
}

export interface TrendMatchResult {
  id: string
  keyword: string
  market: string
  relevance_score: number
  growth_pct?: number
  trend_direction?: string
}

export async function matchTrendKeywords(text: string, market?: string, category?: string, limit = 10) {
  const res = await client.post<ApiResponse<{ matches: TrendMatchResult[]; total: number; analyzed_text: string }>>('/discovery/trends/match', {
    text,
    market,
    category,
    limit,
  })
  return res.data
}

export async function getTrendSyncStatus() {
  const res = await client.get<ApiResponse>('/discovery/trends/status')
  return res.data
}

export async function fetchTrends() {
  const res = await client.post<ApiResponse>('/discovery/trends/fetch')
  return res.data
}

export async function uploadDiscoveryImage(form: FormData) {
  const res = await client.post<ApiResponse<any>>('/discovery/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function listCapturedKeywords(params?: { market?: string }) {
  const res = await client.get<ApiResponse>('/discovery/captured-keywords', { params })
  return res.data
}

export async function deleteCapturedKeyword(id: string) {
  const res = await client.delete<ApiResponse>(`/discovery/captured-keywords/${id}`)
  return res.data
}

export async function listPendingImages() {
  const res = await client.get<ApiResponse<any[]>>('/discovery/pending-images')
  return res.data
}

export async function deleteDiscovery(id: string) {
  const res = await client.delete<ApiResponse>(`/discovery/${id}`)
  return res.data
}

export async function analyzeDiscovery(id: string) {
  const res = await client.post<ApiResponse>(`/discovery/analyze/${id}`, {})
  return res.data
}

export async function confirmDiscovery(id: string) {
  const res = await client.post<ApiResponse>(`/discovery/${id}/confirm`)
  return res.data
}

export async function reanalyzeDiscovery(id: string) {
  const res = await client.post<ApiResponse>(`/discovery/${id}/reanalyze`)
  return res.data
}

export async function listDiscoveryCategories() {
  const res = await client.get<ApiResponse>('/discovery/categories')
  return res.data
}
