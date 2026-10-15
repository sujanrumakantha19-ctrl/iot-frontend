import { useState, useEffect } from 'react'

/**
 * Returns current timestamp (now) in milliseconds, ticking every intervalMs.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
