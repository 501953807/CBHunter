import axios from 'axios'
import { storage } from '../utils/storage'

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = storage.get('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      storage.remove('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
