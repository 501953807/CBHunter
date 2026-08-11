import { storage } from '../utils/storage'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light-luxury' | 'dark-luxury' | 'warm-luxury'

export const THEME_PRESETS: Array<{ id: Theme; label: string; description: string }> = [
  { id: 'light-luxury', label: '浅轻奢', description: '银灰底色、哑光金点缀，适合日常运营' },
  { id: 'dark-luxury', label: '深暗夜轻奢', description: '深灰金属、低亮金色，适合大屏和夜间巡检' },
  { id: 'warm-luxury', label: '暖调轻奢', description: '暖灰棕调、柔和金边，适合长时间表格处理' },
]

const LEGACY_THEME_MAP: Record<string, Theme> = {
  light: 'light-luxury',
  dark: 'dark-luxury',
  'light-luxury': 'light-luxury',
  'dark-luxury': 'dark-luxury',
  'warm-luxury': 'warm-luxury',
}

interface ThemeContextType {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
  presets: typeof THEME_PRESETS
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light-luxury',
  toggle: () => {},
  setTheme: () => {},
  presets: THEME_PRESETS,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = storage.get('theme')
    return LEGACY_THEME_MAP[saved || ''] || 'light-luxury'
  })

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    storage.set('theme', t)
  }, [])

  const toggle = useCallback(() => {
    const index = THEME_PRESETS.findIndex(item => item.id === theme)
    const next = THEME_PRESETS[(index + 1) % THEME_PRESETS.length]?.id || 'light-luxury'
    setTheme(next)
  }, [theme, setTheme])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark-luxury')
    root.dataset.theme = theme
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme, presets: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
