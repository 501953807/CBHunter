import { useEffect, useState } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { storage } from '../../utils/storage'
import { logger } from '../../utils/logger'

function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return false
    return payload.exp * 1000 > Date.now()
  } catch (error) {
    logger.warn('JWT payload validation failed', error)
    return false
  }
}

export function AuthGuard() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = storage.get('token')
    if (!token || !isTokenValid(token)) {
      storage.remove('token')
      navigate('/login', { replace: true })
    } else {
      setChecked(true)
    }
  }, [navigate])

  if (!checked) return null

  return <Outlet />
}
