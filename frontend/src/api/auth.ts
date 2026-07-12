import client from './client'
import type { ApiResponse } from '../types/common'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  display_name?: string
}

export interface UserInfo {
  id: string
  username: string
  email: string
  display_name: string | null
  is_active: boolean
  is_admin: boolean
}

interface AuthData {
  user: UserInfo
  token: { access_token: string; token_type: string }
}

export async function login(data: LoginRequest) {
  const res = await client.post<ApiResponse<AuthData>>('/auth/login', data)
  return res.data
}

export async function register(data: RegisterRequest) {
  const res = await client.post<ApiResponse<AuthData>>('/auth/register', data)
  return res.data
}

export async function getMe() {
  const res = await client.get<ApiResponse<UserInfo>>('/auth/me')
  return res.data
}
