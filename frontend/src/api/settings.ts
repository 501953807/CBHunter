import client from './client'
import type { ApiResponse } from '../types/common'

export interface WarehouseConfig {
  id?: string
  name: string
  city?: string
  address: string
  contact?: string
  fee_per_parcel?: number
  is_default?: boolean
  service_type?: string
  market_scope?: string
  integration_status?: string
  inventory_sync_mode?: string
}

export async function listWarehouses() {
  const res = await client.get<ApiResponse<WarehouseConfig[]>>('/settings/warehouses')
  return res.data
}

export async function createWarehouse(data: WarehouseConfig) {
  const res = await client.post<ApiResponse<WarehouseConfig>>('/settings/warehouses', data)
  return res.data
}

export async function deleteWarehouse(id: string) {
  const res = await client.delete<ApiResponse<{ deleted: boolean }>>(`/settings/warehouses/${id}`)
  return res.data
}

export interface SystemTask {
  id: string
  name: string
  description: string
  trigger: string
  interval_seconds?: number | null
  next_run_time: string | null
  enabled: boolean
}

export interface TaskRunLog {
  id: string
  task_id: string
  task_name: string
  status: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  error_message: string | null
}

export async function listSystemTasks() {
  const res = await client.get<ApiResponse<{ tasks: SystemTask[]; total: number }>>('/settings/tasks/')
  return res.data
}

export async function triggerTask(taskId: string) {
  const res = await client.post<ApiResponse>(`/settings/tasks/${taskId}/run`)
  return res.data
}

export async function toggleTask(taskId: string, enabled: boolean) {
  const res = await client.patch<ApiResponse>(`/settings/tasks/${taskId}`, { enabled })
  return res.data
}

export async function updateTaskTrigger(taskId: string, intervalSeconds: number) {
  const res = await client.put<ApiResponse>(`/settings/tasks/${taskId}/trigger`, { interval_seconds: intervalSeconds })
  return res.data
}

export async function getTaskLogs() {
  const res = await client.get<ApiResponse<{ logs: TaskRunLog[]; total: number; note?: string }>>('/settings/tasks/logs')
  return res.data
}

export async function getSystemConfigItem<T = unknown>(key: string) {
  const res = await client.get<ApiResponse<T>>(`/settings/system-config/${key}`)
  return res.data
}

export async function listSystemConfig() {
  const res = await client.get<ApiResponse>('/settings/system-config')
  return res.data
}

export async function updateSystemConfig(key: string, value: string, label?: string) {
  const res = await client.put<ApiResponse>(`/settings/system-config/${key}`, { value, label })
  return res.data
}

export async function getPinterestAccount() {
  const res = await client.get<ApiResponse<{ email: string | null; configured: boolean }>>('/settings/system-config/pinterest-account')
  return res.data
}

export async function updatePinterestAccount(data: { email: string; password: string }) {
  const res = await client.put<ApiResponse>('/settings/system-config/pinterest-account', data)
  return res.data
}

export async function listUsers() {
  const res = await client.get<ApiResponse<any[]>>('/settings/users')
  return res.data
}

export async function createUser(data: Record<string, unknown>) {
  const res = await client.post<ApiResponse>('/settings/users', data)
  return res.data
}

export async function updateUser(username: string, data: Record<string, unknown>) {
  const res = await client.put<ApiResponse>(`/settings/users/${username}`, data)
  return res.data
}

export async function deleteUser(username: string) {
  const res = await client.delete<ApiResponse>(`/settings/users/${username}`)
  return res.data
}

export async function updateUserPassword(username: string, password: string) {
  const res = await client.put<ApiResponse>(`/settings/users/${username}/password`, { password })
  return res.data
}

export interface AccessRole {
  id: string
  code: string
  name: string
  description?: string | null
  data_scope: string
  is_system: boolean
  is_active: boolean
  permissions: string[]
}

export interface AccessUser {
  id: string
  username: string
  display_name?: string | null
  email: string
  is_active: boolean
  is_admin: boolean
  role_ids: string[]
  store_ids: string[]
}

export interface AccessStore {
  id: string
  platform: string
  account_name: string
  shop_id?: string | null
  is_active: boolean
}

export interface AccessControlMatrix {
  permissions: Array<Record<string, unknown>>
  roles: AccessRole[]
  user_roles: Record<string, string[]>
  stores: AccessStore[]
  user_stores: Record<string, string[]>
  users: AccessUser[]
}

export async function getAccessControl() {
  const res = await client.get<ApiResponse<AccessControlMatrix>>('/settings/access-control')
  return res.data
}

export async function updateUserRoles(username: string, roleIds: string[]) {
  const res = await client.put<ApiResponse>(`/settings/users/${username}/roles`, { role_ids: roleIds })
  return res.data
}

export async function updateUserStores(username: string, storeIds: string[]) {
  const res = await client.put<ApiResponse>(`/settings/users/${username}/stores`, { store_ids: storeIds })
  return res.data
}

export async function listProviders() {
  const res = await client.get<ApiResponse<any>>('/settings/providers')
  return res.data
}

export async function getProviderTaskMatrix() {
  const res = await client.get<ApiResponse<any>>('/settings/provider-task-matrix')
  return res.data
}

export async function getMyProviders() {
  const res = await client.get<ApiResponse<any>>('/settings/my-providers')
  return res.data
}

export async function saveMyProviders(config: Record<string, unknown>) {
  const res = await client.put<ApiResponse>('/settings/my-providers', { config })
  return res.data
}

export interface DictionaryDefinition {
  id: string
  label: string
  fields: Array<{ key: string; label: string }>
  editor?: string
}

export interface DictionaryAdminConfig {
  dictionaries: Record<string, Array<Record<string, unknown>>>
  definitions: DictionaryDefinition[]
}

export async function listDicts() {
  const res = await client.get<ApiResponse<DictionaryAdminConfig>>('/settings/dict')
  return res.data
}

export async function createDictItem(dict: string, data: Record<string, unknown>) {
  const res = await client.post<ApiResponse>(`/settings/dict/${dict}`, data)
  return res.data
}

export async function updateDictItem(dict: string, id: string, data: Record<string, unknown>) {
  const res = await client.put<ApiResponse>(`/settings/dict/${dict}/${id}`, data)
  return res.data
}

export async function deleteDictItem(dict: string, id: string) {
  const res = await client.delete<ApiResponse>(`/settings/dict/${dict}/${id}`)
  return res.data
}

export async function listFeeRates() {
  const res = await client.get<ApiResponse<any>>('/settings/fee-rates')
  return res.data
}

export async function updateFeeRates(data: Record<string, unknown>) {
  const res = await client.put<ApiResponse>('/settings/fee-rates', data)
  return res.data
}
