import { useState, useEffect } from 'react'
import { useUser } from './use-user'

export function useUnreadMessages() {
  const { user } = useUser()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/messages/unread-count')
        if (!response.ok) return

        const data = await response.json()
        setUnreadCount(data.unread_count || 0)
      } catch (error) {
        console.error('Error fetching unread count:', error)
      }
    }

    fetchUnreadCount()

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000)

    return () => clearInterval(interval)
  }, [user])

  return unreadCount
}

