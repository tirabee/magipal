import './App.css'

const MOCK_PALETTES = [
  { id: 1, name: 'Dark Forest', colors: ['#1a2e1a', '#2d4a2d', '#3d6b3d', '#8fbc8f', '#c8e6c8'] },
  { id: 2, name: 'Ember Cave', colors: ['#2e1a0e', '#6b3a1f', '#c4622d', '#e8943a', '#f5c842'] },
  { id: 3, name: 'Void Ocean', colors: ['#0a0e2e', '#1a2456', '#2e4080', '#4a6eb0', '#8ab4e8'] },
]

function App() {
  return (
    <div className="app">

      {/* Title Bar */}
      <div className="titlebar">
        <span className="titlebar-name">Magipal</span>
        <span className="titlebar-sep">—</span>
        <span className="titlebar-file">no palette selected</span>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">Palettes</div>
        <div className="sidebar-list">
          {MOCK_PALETTES.map((p, i) => (
            <div key={p.id} className={`palette-item ${i === 0 ? 'active' : ''}`}>
              <div className="palette-item-swatches">
                {p.colors.slice(0, 5).map(c => (
                  <div
                    key={c}
                    className="palette-item-swatch"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span className="palette-item-name">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <button className="btn btn-accent btn-full">+ New Palette</button>
        </div>
      </div>

      {/* Main Area */}
      <div className="main">
        <div className="main-toolbar">
          <button className="btn">Import PNG</button>
          <button className="btn">Import URL</button>
          <button className="btn">✨ AI Generate</button>
        </div>
        <div className="main-content">
          <div className="empty-state">
            <div className="empty-state-icon">🎨</div>
            <div className="empty-state-text">select a palette or create a new one</div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="statusbar">
        <span className="statusbar-item">magipal v0.1.0</span>
        <span className="statusbar-item">3 palettes</span>
      </div>

    </div>
  )
}

export default App