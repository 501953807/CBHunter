import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createRealtimeTicket } from '../api/realtime'
import { storage } from '../utils/storage'
import { logger } from '../utils/logger'

export function useRealtimeNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!storage.get('token')) return
    let socket: WebSocket | null = null
    let retryTimer: number | null = null
    let stopped = false

    const connect = async () => {
      try {
        const response = await createRealtimeTicket()
        const ticket = response.data?.ticket
        if (!ticket || stopped) return
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        socket = new WebSocket(`${protocol}//${window.location.host}/api/v1/realtime/notifications?ticket=${encodeURIComponent(ticket)}`)
        socket.onmessage = event => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'notification') {
              queryClient.invalidateQueries({ queryKey: ['notifications'] })
            }
          } catch (error) {
            logger.error('Read realtime notification failed', error)
          }
        }
        socket.onclose = () => {
          if (!stopped) retryTimer = window.setTimeout(connect, 5000)
        }
        socket.onerror = error => logger.error('Realtime notification connection failed', error)
      } catch (error) {
        logger.error('Create realtime ticket failed', error)
        if (!stopped) retryTimer = window.setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      stopped = true
      if (retryTimer != null) window.clearTimeout(retryTimer)
      socket?.close()
    }
  }, [queryClient])
}
