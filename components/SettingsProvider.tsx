'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { DEFAULT_WEIGHTS, type Weights } from '@/lib/utils'

type SettingsCtx = {
  weights: Weights
  isLoading: boolean
  reload: () => void
}

const SettingsContext = createContext<SettingsCtx>({
  weights: DEFAULT_WEIGHTS,
  isLoading: true,
  reload: () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}

export default function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    // Client is created inside useEffect so it never runs on the server
    // during Next.js static generation
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let cancelled = false
    setIsLoading(true)

    supabase
      .from('settings')
      .select('batting_weight, bowling_weight, fielding_weight')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          setWeights({
            batting: Number(data.batting_weight),
            bowling: Number(data.bowling_weight),
            fielding: Number(data.fielding_weight),
          })
        }
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [tick])

  return (
    <SettingsContext.Provider value={{ weights, isLoading, reload: () => setTick(t => t + 1) }}>
      {children}
    </SettingsContext.Provider>
  )
}
