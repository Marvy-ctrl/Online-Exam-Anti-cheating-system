import { useEffect, useRef, useState } from 'react'

interface UseExamTimerOptions {
  enabled: boolean
  expectedEndTime?: string
  storageKey: string
  onExpire: () => void
}

export function useExamTimer({
  enabled,
  expectedEndTime,
  storageKey,
  onExpire,
}: UseExamTimerOptions) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const onExpireRef = useRef(onExpire)
  const expiredRef = useRef(false)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (!enabled) return

    const storedEndTime = sessionStorage.getItem(storageKey)
    const endTimeValue = expectedEndTime || storedEndTime
    if (!endTimeValue) return

    const endTime = new Date(endTimeValue)
    if (Number.isNaN(endTime.getTime())) return

    expiredRef.current = false
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((endTime.getTime() - Date.now()) / 1000),
      )
      setTimeLeft(remaining)
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpireRef.current()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [enabled, expectedEndTime, storageKey])

  return timeLeft
}

export function formatExamTime(seconds: number | null) {
  if (seconds === null) return '--:--:--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}
