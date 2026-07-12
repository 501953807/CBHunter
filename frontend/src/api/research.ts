import client from './client'
import type { ApiResponse } from '../types/common'
import type { KeywordResult, SavedResearch, Competitor, TrendingProduct } from '../types/research'

export async function searchKeywords(q: string, platform: string) {
  const res = await client.get<ApiResponse<KeywordResult>>('/research/keywords', { params: { q, platform } })
  return res.data
}

export async function getSavedResearch() {
  const res = await client.get<ApiResponse<SavedResearch[]>>('/research/saved')
  return res.data
}

export async function saveResearch(keyword: string, platform: string) {
  const res = await client.post<ApiResponse<SavedResearch>>('/research/saved', { keyword, platform })
  return res.data
}

export async function deleteResearch(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/research/saved/${id}`)
  return res.data
}

export async function getTrendingProducts(platform?: string) {
  const params = platform ? { platform } : {}
  const res = await client.get<ApiResponse<TrendingProduct[]>>('/research/trending', { params })
  return res.data
}

export async function syncTrendingProducts() {
  const res = await client.post<ApiResponse<{
    shopee: number
    temu: number
    tiktok: number
    total: number
    errors: string[]
  }>>('/scout/trending-products/sync')
  return res.data
}

export async function addTrendingProduct(data: { platform: string; name: string; price_min?: number; price_max?: number; sales_volume?: number; sales_growth_rate?: number; category_path?: string; market?: string; tags?: string[] }) {
  const res = await client.post<ApiResponse<TrendingProduct>>('/research/trending', data)
  return res.data
}

export async function deleteTrendingProduct(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/research/trending/${id}`)
  return res.data
}


export async function getCompetitors() {
  const res = await client.get<ApiResponse<Competitor[]>>('/research/competitors')
  return res.data
}

export async function addCompetitor(data: { platform: string; name: string; seller_name?: string; price?: number }) {
  const res = await client.post<ApiResponse<Competitor>>('/research/competitors', data)
  return res.data
}

export async function deleteCompetitor(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/research/competitors/${id}`)
  return res.data
}
