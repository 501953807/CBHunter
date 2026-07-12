import client from './client'
import type { ApiResponse } from '../types/common'
import type { RecommenderBundle, RecommenderReadiness } from '../types/recommender'

export async function getRecommenderReadiness(platform: string, market: string) {
  const res = await client.get<ApiResponse<RecommenderReadiness>>('/recommender/readiness', {
    params: { platform, market }
  })
  return res.data
}

export async function getRecommendations(platform: string, market: string, category?: string) {
  const params: Record<string, string> = { platform, market }
  if (category) params.category = category
  const res = await client.get<ApiResponse<RecommenderBundle>>('/recommender/recommendations', { params })
  return res.data
}

export async function getRecommendationBundle(platform: string, market: string) {
  const res = await client.get<ApiResponse<RecommenderBundle>>('/recommender/bundle', {
    params: { platform, market }
  })
  return res.data
}

export async function getRecommenderCategories(platform: string, market: string) {
  const res = await client.get<ApiResponse<{ categories: string[] }>>('/recommender/categories', {
    params: { platform, market }
  })
  return res.data
}
