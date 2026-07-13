import { useState, useEffect } from 'react'
import { getPreference, setPreference } from './storage'

export type Theme = 'dark' | 'light'
export type SwatchStyle = 'squares' | 'circles' | 'bar'

/**
 * preferences.json (via Tauri) is the source of truth. localStorage holds a copy
 * of the theme only as a *paint cache*: reading it is synchronous, so the inline
 * script in index.html can apply the theme before React mounts and avoid the
 * dark flash a light-theme user would otherwise see on every launch.
 */
function cacheThemeForNextLaunch(theme: Theme) {
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // Storage unavailable: the app still works, you just get the flash back.
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  cacheThemeForNextLaunch(theme)
}

export function usePreferences() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [swatchStyle, setSwatchStyleState] = useState<SwatchStyle>('squares')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getPreference('theme'),
      getPreference('swatchStyle'),
    ])
      .then(([t, s]) => {
        const resolvedTheme = (t as Theme) ?? 'dark'
        const resolvedSwatch = (s as SwatchStyle) ?? 'squares'
        setThemeState(resolvedTheme)
        setSwatchStyleState(resolvedSwatch)
        applyTheme(resolvedTheme)
      })
      .finally(() => setLoaded(true))
  }, [])

  const setTheme = async (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    await setPreference('theme', t)
  }

  const setSwatchStyle = async (s: SwatchStyle) => {
    setSwatchStyleState(s)
    await setPreference('swatchStyle', s)
  }

  return { theme, setTheme, swatchStyle, setSwatchStyle, loaded }
}
