import { useState, useEffect } from 'react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getPreference, setPreference } from './storage'

export type Theme = 'dark' | 'light'
export type SwatchStyle = 'squares' | 'circles' | 'bar'

/** Whole-UI zoom, not just text: scales swatches and click targets too. */
export const UI_SCALES = [1, 1.25, 1.5, 1.75] as const
export type UiScale = (typeof UI_SCALES)[number]

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

function applyContrast(high: boolean) {
  const root = document.documentElement
  if (high) root.setAttribute('data-contrast', 'high')
  else root.removeAttribute('data-contrast')
}

function applyControls(always: boolean) {
  const root = document.documentElement
  if (always) root.setAttribute('data-controls', 'always')
  else root.removeAttribute('data-controls')
}

/**
 * Real webview zoom rather than a CSS transform: it scales the layout, the
 * swatches and the click targets together, and viewport units stay correct.
 * A CSS `zoom` on the body would push the 100vh/100vw grid off-screen.
 */
async function applyScale(scale: UiScale) {
  try {
    await getCurrentWebviewWindow().setZoom(scale)
  } catch {
    // Not fatal -- the app is simply left at its current size.
  }
}

export function usePreferences() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [swatchStyle, setSwatchStyleState] = useState<SwatchStyle>('squares')
  const [uiScale, setUiScaleState] = useState<UiScale>(1)
  const [highContrast, setHighContrastState] = useState(false)
  const [alwaysShowControls, setAlwaysShowControlsState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getPreference('theme'),
      getPreference('swatchStyle'),
      getPreference('uiScale'),
      getPreference('highContrast'),
      getPreference('alwaysShowControls'),
    ])
      .then(([t, s, z, c, k]) => {
        const resolvedTheme = (t as Theme) ?? 'dark'
        const resolvedSwatch = (s as SwatchStyle) ?? 'squares'
        const parsedScale = Number(z)
        const resolvedScale = (UI_SCALES as readonly number[]).includes(parsedScale)
          ? (parsedScale as UiScale)
          : 1
        const resolvedContrast = c === 'true'
        const resolvedControls = k === 'true'

        setThemeState(resolvedTheme)
        setSwatchStyleState(resolvedSwatch)
        setUiScaleState(resolvedScale)
        setHighContrastState(resolvedContrast)
        setAlwaysShowControlsState(resolvedControls)

        applyTheme(resolvedTheme)
        applyContrast(resolvedContrast)
        applyControls(resolvedControls)
        void applyScale(resolvedScale)
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

  const setUiScale = async (z: UiScale) => {
    setUiScaleState(z)
    await applyScale(z)
    await setPreference('uiScale', String(z))
  }

  const setHighContrast = async (high: boolean) => {
    setHighContrastState(high)
    applyContrast(high)
    await setPreference('highContrast', String(high))
  }

  const setAlwaysShowControls = async (always: boolean) => {
    setAlwaysShowControlsState(always)
    applyControls(always)
    await setPreference('alwaysShowControls', String(always))
  }

  return {
    theme,
    setTheme,
    swatchStyle,
    setSwatchStyle,
    uiScale,
    setUiScale,
    highContrast,
    setHighContrast,
    alwaysShowControls,
    setAlwaysShowControls,
    loaded,
  }
}
