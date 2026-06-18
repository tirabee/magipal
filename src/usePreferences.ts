import { useState, useEffect } from 'react'
import { getPreference, setPreference } from './storage'

export type Theme = 'dark' | 'light'
export type SwatchStyle = 'squares' | 'circles' | 'bar'

export function usePreferences() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [swatchStyle, setSwatchStyleState] = useState<SwatchStyle>('squares')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getPreference('theme'),
      getPreference('swatchStyle'),
    ]).then(([t, s]) => {
      const resolvedTheme = (t as Theme) ?? 'dark'
      const resolvedSwatch = (s as SwatchStyle) ?? 'squares'
      setThemeState(resolvedTheme)
      setSwatchStyleState(resolvedSwatch)
      document.documentElement.setAttribute('data-theme', resolvedTheme)
      setLoaded(true)
    })
  }, [])

  const setTheme = async (t: Theme) => {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    await setPreference('theme', t)
  }

  const setSwatchStyle = async (s: SwatchStyle) => {
    setSwatchStyleState(s)
    await setPreference('swatchStyle', s)
  }

  return { theme, setTheme, swatchStyle, setSwatchStyle, loaded }
}