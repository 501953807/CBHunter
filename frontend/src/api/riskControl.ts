import client from './client'
import type { ApiResponse } from '../types/common'
import type { OperationRecord } from './operations'
import type { RiskAuditItem, RiskControlOverview, RiskControlRisk, RiskStateUpdateRequest } from '../types/riskControl'

export async function getRiskControlOverview() {
  const response = await client.get<ApiResponse<RiskControlOverview>>('/risk-control/overview')
  return response.data
}

export async function updateRiskControlState(riskId: string, payload: RiskStateUpdateRequest) {
  const response = await client.post<ApiResponse<RiskControlRisk>>(`/risk-control/events/${encodeURIComponent(riskId)}/state`, payload)
  return response.data
}

export async function getRiskControlAudit(riskId: string) {
  const response = await client.get<ApiResponse<RiskAuditItem[]>>(`/risk-control/events/${encodeURIComponent(riskId)}/audit`)
  return response.data
}

export async function createRiskOperationAction(riskId: string) {
  const response = await client.post<ApiResponse<OperationRecord>>(`/risk-control/events/${encodeURIComponent(riskId)}/operation-action`)
  return response.data
}
