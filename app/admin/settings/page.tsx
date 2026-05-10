'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/ToastProvider'
import { useSettings } from '@/components/SettingsProvider'
import Spinner from '@/components/Spinner'

function WeightInput({
  label,
  value,
  onChange,
  description,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  description: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-semibold text-gray-900">{label}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={e => onChange(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
            className="w-16 text-right px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent tabular-nums"
          />
          <span className="text-sm text-gray-500 font-medium">%</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-2 accent-green-700 cursor-pointer mt-2"
      />
    </div>
  )
}

export default function SettingsPage() {
  const { user, supabase, isLoading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { reload: reloadSettings } = useSettings()
  const router = useRouter()

  const [batting, setBatting] = useState(40)
  const [bowling, setBowling] = useState(40)
  const [fielding, setFielding] = useState(20)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from('settings')
      .select('batting_weight, bowling_weight, fielding_weight')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setBatting(Math.round(Number(data.batting_weight) * 100))
          setBowling(Math.round(Number(data.bowling_weight) * 100))
          setFielding(Math.round(Number(data.fielding_weight) * 100))
        }
        setFetching(false)
      })
  }, [user, supabase])

  const total = batting + bowling + fielding
  const isValid = total === 100
  const totalColor = isValid ? 'text-green-700' : 'text-red-600'

  const handleSave = async () => {
    if (!isValid || saving) return
    setSaving(true)
    const { error } = await supabase
      .from('settings')
      .update({
        batting_weight: batting / 100,
        bowling_weight: bowling / 100,
        fielding_weight: fielding / 100,
      })
      .eq('id', 1)

    if (error) {
      showToast('Failed to save settings', 'error')
    } else {
      reloadSettings()
      showToast('Settings saved — weights updated')
    }
    setSaving(false)
  }

  if (authLoading || !user) return null

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Adjust how each skill is weighted when balancing teams.
        </p>
      </div>

      {fetching ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="font-bold text-gray-900 mb-1">Team Balancing Weights</h2>
            <p className="text-xs text-gray-400 mb-4">
              These percentages determine how much each skill contributes to a player&apos;s overall score
              used for team balancing. They must add up to 100%.
            </p>

            <div className="space-y-3">
              <WeightInput
                label="Batting"
                value={batting}
                onChange={setBatting}
                description="Weight applied to batting rating"
              />
              <WeightInput
                label="Bowling"
                value={bowling}
                onChange={setBowling}
                description="Weight applied to bowling rating"
              />
              <WeightInput
                label="Fielding"
                value={fielding}
                onChange={setFielding}
                description="Weight applied to fielding rating"
              />
            </div>

            {/* Total indicator */}
            <div className={`flex items-center justify-between mt-4 pt-4 border-t border-gray-100`}>
              <span className="text-sm font-medium text-gray-600">Total</span>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold tabular-nums ${totalColor}`}>{total}%</span>
                {isValid ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Valid</span>
                ) : (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                    {total > 100 ? `${total - 100}% over` : `${100 - total}% short`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="w-full py-3 rounded-xl bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>

          {!isValid && (
            <p className="text-center text-xs text-red-500">
              Weights must add up to exactly 100% before saving.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
