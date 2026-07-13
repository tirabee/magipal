import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

interface TitleBarProps {
  fileName: string
  onSettingsClick: () => void
  settingsOpen: boolean
}

export function TitleBar({ fileName, onSettingsClick }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized)

    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized)
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  const handleMinimize = () => appWindow.minimize()
  const handleMaximizeToggle = () => appWindow.toggleMaximize()
  const handleClose = () => appWindow.close()

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-drag-area" data-tauri-drag-region>
        <span className="titlebar-name" data-tauri-drag-region>Magipal</span>
        <span className="titlebar-sep" data-tauri-drag-region>—</span>
        <span className="titlebar-file" data-tauri-drag-region>{fileName}</span>
      </div>

      <button
        className="settings-btn"
        onClick={onSettingsClick}
        title="Settings"
      >
        ⚙️
      </button>

      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button className="titlebar-btn" onClick={handleMaximizeToggle} title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2.5" width="7" height="7" fill="var(--bg-panel)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-btn-close" onClick={handleClose} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}