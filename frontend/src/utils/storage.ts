/** Safe localStorage wrapper — never throws on access. */
import { logger } from './logger'

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      logger.error(`Storage read failed for ${key}`, error)
      return null
    }
  },

  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      logger.error(`Storage write failed for ${key}`, error)
      return false
    }
  },

  remove(key: string): boolean {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      logger.error(`Storage remove failed for ${key}`, error)
      return false
    }
  },

  getJSON<T>(key: string): T | null {
    const raw = this.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch (error) {
      logger.error(`Storage JSON parse failed for ${key}`, error)
      return null
    }
  },

  setJSON(key: string, value: unknown): boolean {
    try {
      return this.set(key, JSON.stringify(value))
    } catch (error) {
      logger.error(`Storage JSON serialization failed for ${key}`, error)
      return false
    }
  },
}
