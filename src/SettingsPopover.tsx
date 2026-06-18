import type { Theme, SwatchStyle } from './usePreferences'

interface SettingsPopoverProps {
  theme: Theme
  swatchStyle: SwatchStyle
  onThemeChange: (t: Theme) => void
  onSwatchStyleChange: (s: SwatchStyle) => void
  onClose: () => void
}

export function SettingsPopover({
  theme,
  swatchStyle,
  onThemeChange,
  onSwatchStyleChange,
  onClose,
}: SettingsPopoverProps) {
  return (
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div className="popover">
        <div className="popover-section">
          <div className="popover-label">Theme</div>
          <div className="popover-options">
            <button
              className={`popover-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeChange('dark')}
            >
              🌙 Dark
            </button>
            <button
              className={`popover-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onThemeChange('light')}
            >
              ☀️ Light
            </button>
          </div>
        </div>

        <div className="popover-divider" />

        <div className="popover-section">
          <div className="popover-label">Swatch Style</div>
          <div className="popover-options">
            <button
              className={`popover-option ${swatchStyle === 'squares' ? 'active' : ''}`}
              onClick={() => onSwatchStyleChange('squares')}
            >
              ▪ Squares
            </button>
            <button
              className={`popover-option ${swatchStyle === 'circles' ? 'active' : ''}`}
              onClick={() => onSwatchStyleChange('circles')}
            >
              ● Circles
            </button>
            <button
              className={`popover-option ${swatchStyle === 'bar' ? 'active' : ''}`}
              onClick={() => onSwatchStyleChange('bar')}
            >
              ▬ Bar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}