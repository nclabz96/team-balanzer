'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_MAX_SKILL_GAP, DEFAULT_WEIGHTS, type Weights } from '@/lib/utils'

type SettingsCtx = {
  weights: Weights
  maxSkillGap: number
  isLoading: boolean
  reload: () => void
}

const SettingsContext = createContext<SettingsCtx>({
  weights: DEFAULT_WEIGHTS,
  maxSkillGap: DEFAULT_MAX_SKILL_GAP,
  isLoading: true,
  reload: () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}

export default function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [maxSkillGap, setMaxSkillGap] = useState<number>(DEFAULT_MAX_SKILL_GAP)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    // Client is created inside useEffect so it never runs on the server
    // during Next.js static generation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL    || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
    )

    let cancelled = false
    setIsLoading(true)

    supabase
      .from('settings')
      .select('batting_weight, bowling_weight, fielding_weight, max_skill_gap')
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
          // Fall back to default if the column hasn't been migrated yet.
          const gap = data.max_skill_gap
          if (gap !== null && gap !== undefined && !Number.isNaN(Number(gap))) {
            setMaxSkillGap(Number(gap))
          }
        }
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [tick])

  return (
    <SettingsContext.Provider
      value={{ weights, maxSkillGap, isLoading, reload: () => setTick(t => t + 1) }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
