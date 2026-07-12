import client from './client'
import type { ApiResponse } from '../types/common'
import type { CockpitData, CockpitFilters } from '../types/cockpit'

export async function getOperatingCockpit(params?: CockpitFilters) {
  const response = await client.get<ApiResponse<CockpitData>>('/dashboard/cockpit', { params })
  return response.data
}
