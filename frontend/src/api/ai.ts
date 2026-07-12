import client from './client'
import type { ApiResponse } from '../types/common'
import type { AISuggestion } from '../types/ai'

export async function getSuggestions(severity?: string, type?: string) {
  const params: Record<string, string> = {}
  if (severity) params.severity = severity
  if (type) params.suggestion_type = type
  const res = await client.get<ApiResponse<AISuggestion[]>>('/ai-suggestions', { params })
  return res.data
}

export async function markRead(id: string) {
  const res = await client.put<ApiResponse<AISuggestion>>(`/ai-suggestions/${id}/read`)
  return res.data
}

export async function markApplied(id: string) {
  const res = await client.put<ApiResponse<AISuggestion>>(`/ai-suggestions/${id}/apply`)
  return res.data
}

export async function dismissSuggestion(id: string) {
  const res = await client.put<ApiResponse<AISuggestion>>(`/ai-suggestions/${id}/dismiss`)
  return res.data
}

export async function runAnalysis() {
  const res = await client.post<ApiResponse<AISuggestion[]>>('/ai-suggestions/run')
  return res.data
}
