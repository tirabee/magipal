import type { Theme, SwatchStyle, UiScale } from './usePreferences'
import { UI_SCALES } from './usePreferences'

interface SettingsPopoverProps {
  theme: Theme
  swatchStyle: SwatchStyle
  uiScale: UiScale
  highContrast: boolean
  alwaysShowControls: boolean
  onThemeChange: (t: Theme) => void
  onSwatchStyleChange: (s: SwatchStyle) => void
  onUiScaleChange: (z: UiScale) => void
  onHighContrastChange: (high: boolean) => void
  onAlwaysShowControlsChange: (always: boolean) => void
  onClose: () => void
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="popover-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="popover-toggle-text">
        <span className="popover-toggle-label">{label}</span>
        <span className="popover-toggle-description">{description}</span>
      </span>
    </label>
  )
}

export function SettingsPopover({
  theme,
  swatchStyle,
  uiScale,
  highContrast,
  alwaysShowControls,
  onThemeChange,
  onSwatchStyleChange,
  onUiScaleChange,
  onHighContrastChange,
  onAlwaysShowControlsChange,
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

        <div className="popover-divider" />

        <div className="popover-section">
          <div className="popover-label">Accessibility</div>

          <div className="popover-sublabel">Interface size</div>
          <div className="popover-options">
            {UI_SCALES.map(scale => (
              <button
                key={scale}
                className={`popover-option ${uiScale === scale ? 'active' : ''}`}
                onClick={() => onUiScaleChange(scale)}
                title={`Scale the whole interface to ${Math.round(scale * 100)}%`}
              >
                {Math.round(scale * 100)}%
              </button>
            ))}
          </div>

          <Toggle
            checked={highContrast}
            onChange={onHighContrastChange}
            label="High contrast"
            description="Stronger text and borders"
          />
          <Toggle
            checked={alwaysShowControls}
            onChange={onAlwaysShowControlsChange}
            label="Always show controls"
            description="Don't hide buttons until hover"
          />
        </div>
      </div>
    </>
  )
}
