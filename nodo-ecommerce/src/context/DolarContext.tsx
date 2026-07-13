'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'

interface DolarState {
  rate: number | null
  loading: boolean
  error: boolean
}

const DolarContext = createContext<DolarState>({ rate: null, loading: false, error: false })

const POLL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

async function fetchDolarBlue(): Promise<number | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.venta === 'number' ? data.venta : null
  } catch {
    return null
  }
}

export function DolarProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return

    async function poll() {
      setLoading(true)
      setError(false)
      const value = await fetchDolarBlue()
      if (value !== null) {
        setRate(value)
      } else {
        setError(true)
      }
      setLoading(false)
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled])

  return (
    <DolarContext.Provider value={{ rate, loading, error }}>
      {children}
    </DolarContext.Provider>
  )
}

export function useDolar(): DolarState {
  return useContext(DolarContext)
}
