import client from './client'
import type { ApiResponse } from '../types/common'
import type {
  BusinessFlowOverview,
  BusinessFlowAssignee,
  BusinessFlowTaskBulkRequest,
  BusinessFlowTaskCommentRequest,
  BusinessFlowTaskCompleteReviewRequest,
  BusinessFlowTaskEvent,
  BusinessFlowTaskResult,
} from '../types/businessFlow'

export async function getBusinessFlowOverview() {
  const response = await client.get<ApiResponse<BusinessFlowOverview>>('/business-flow/overview')
  return response.data
}

export async function getBusinessFlowAssignees() {
  const response = await client.get<ApiResponse<BusinessFlowAssignee[]>>('/business-flow/assignees')
  return response.data
}

export async function updateBusinessFlowTasks(payload: BusinessFlowTaskBulkRequest) {
  const response = await client.post<ApiResponse<BusinessFlowTaskResult[]>>('/business-flow/tasks/bulk', payload)
  return response.data
}

export async function getBusinessFlowTaskEvents(taskId: string) {
  const response = await client.get<ApiResponse<BusinessFlowTaskEvent[]>>(`/business-flow/tasks/${taskId}/events`)
  return response.data
}

export async function addBusinessFlowTaskComment(taskId: string, payload: BusinessFlowTaskCommentRequest) {
  const response = await client.post<ApiResponse<BusinessFlowTaskEvent>>(`/business-flow/tasks/${taskId}/comments`, payload)
  return response.data
}

export async function completeBusinessFlowTaskWithReview(taskId: string, payload: BusinessFlowTaskCompleteReviewRequest) {
  const response = await client.post<ApiResponse<BusinessFlowTaskResult>>(`/business-flow/tasks/${taskId}/complete-review`, payload)
  return response.data
}
