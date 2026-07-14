import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { useState } from 'react'
import type { Palette } from './storage'
import { reorderPalettes, reorderFolders, movePaletteToFolder, renamePalette, renameFolder, togglePaletteLock } from './storage'


// ── Types ────────────────────────────────────────────────────────

interface SidebarProps {
  palettes: Palette[]
  folders: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onDeleteFolder: (name: string) => void
  onNewPalette: () => void
  onNewFolder: () => void
  /**
   * Every change to saved data goes through App's mutate(), which snapshots the
   * state first so the change can be undone. Calling a storage function directly
   * from here would work, but the change would be invisible to undo.
   */
  onMutate: (label: string, action: () => Promise<void>) => Promise<void>
}

// ── Draggable Palette Item ────────────────────────────────────────

function DraggablePaletteItem({ palette, selected, onSelect, onDelete, indented, onRename, onToggleLock }: {
  palette: Palette
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  indented?: boolean
  onRename: (newName: string) => void
  onToggleLock: () => void
}) {
  const [editingName, setEditingName] = useState<string | null>(null)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: palette.id,
    data: { type: 'palette', palette },
  })

  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `drop-palette:${palette.id}`,
    data: { type: 'palette-drop', palette },
  })

  const setRef = (el: HTMLElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={setRef}
      className={[
        'palette-item',
        selected ? 'active' : '',
        indented ? 'indented' : '',
        isDropOver ? 'drop-target' : '',
        palette.locked ? 'palette-locked' : '',
      ].join(' ')}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      onClick={onSelect}
      onContextMenu={e => { e.preventDefault(); onToggleLock() }}
      {...attributes}
      {...listeners}
    >
      <div className="palette-item-swatches">
        {palette.colors.slice(0, 5).map((c, i) => (
          <div key={i} className="palette-item-swatch" style={{ background: c.hex }} />
        ))}
        {palette.colors.length === 0 && (
          <div className="palette-item-swatch" style={{ background: 'transparent' }} />
        )}
      </div>
{editingName !== null ? (
  <input
    className="folder-rename-input"
    value={editingName}
    autoFocus
    onChange={e => setEditingName(e.target.value)}
    onBlur={async () => {
      if (editingName.trim() && editingName.trim() !== palette.name) {
        await onRename(editingName.trim())
      }
      setEditingName(null)
    }}
    onKeyDown={e => {
      if (e.key === 'Enter') e.currentTarget.blur()
      if (e.key === 'Escape') setEditingName(null)
    }}
    onClick={e => e.stopPropagation()}
  />
) : (
  <span
    className="palette-item-name"
    onDoubleClick={e => {
      if (palette.locked) return
      e.stopPropagation()
      setEditingName(palette.name)
    }}
  >
    {palette.name}
  </span>
)}
{palette.locked && (
  <span className="palette-lock-icon" title="Locked">🔒</span>
)}
      {!palette.locked && (
  <button
    className="palette-delete"
    onClick={e => { e.stopPropagation(); onDelete() }}
    title="Delete palette"
  >×</button>
)}
    </div>
  )
}

// ── Droppable Folder ──────────────────────────────────────────────

/**
 * How many tints the folders cycle through. Each folder gets its own faint hue
 * so that "these palettes are grouped" reads at a glance, rather than resting on
 * indentation alone. Assigned by position, so neighbours are always different.
 */
export const FOLDER_TINTS = 5

function DroppableFolder({ name, tint, palettes, selectedId, onSelect, onDelete, onDeletePalette, onRename, onToggleLock }: {
  name: string
  tint: number
  palettes: Palette[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: () => void
  onDeletePalette: (id: string) => void
  onRename: (newName: string) => void
  onRenamePalette: (id: string, newName: string) => void
  onToggleLock: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [editingName, setEditingName] = useState<string | null>(null)
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${name}`,
    data: { type: 'folder', name },
  })

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `folder-drag:${name}`,
    data: { type: 'folder', name },
  })

  // The folder holding the selection gets a stronger wash of its own tint, so
  // "which folder is this" and "which folder am I in" are two separate signals
  // rather than one doing double duty.
  const holdsSelection = palettes.some(p => p.id === selectedId)

  return (
    <div
      className={`folder-group ${holdsSelection ? 'folder-group-active' : ''}`}
      data-tint={tint}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <div
        ref={node => { setNodeRef(node); setDragRef(node) }}
        className={`folder-item ${isOver ? 'folder-drop-target' : ''}`}
        {...attributes}
        {...listeners}
      >
        <span
          className="folder-icon"
          style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        >
          {open ? '▾' : '▸'}
        </span>
        {editingName !== null ? (
  <input
    className="folder-rename-input"
    value={editingName}
    autoFocus
    onChange={e => setEditingName(e.target.value)}
    onBlur={async () => {
      if (editingName.trim() && editingName.trim() !== name) {
        await onRename(editingName.trim())
      }
      setEditingName(null)
    }}
    onKeyDown={e => {
      if (e.key === 'Enter') e.currentTarget.blur()
      if (e.key === 'Escape') setEditingName(null)
    }}
    onClick={e => e.stopPropagation()}
  />
) : (
  <span
    className="folder-name"
    onDoubleClick={e => { e.stopPropagation(); setEditingName(name) }}
  >
    {name}
  </span>
)}
        <button
          className="folder-delete"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Delete folder"
        >×</button>
      </div>
      {open && palettes.map(p => (
        <DraggablePaletteItem
          key={p.id}
          palette={p}
          selected={p.id === selectedId}
          onSelect={() => onSelect(p.id)}
          onDelete={() => onDeletePalette(p.id)}
          onRename={newName => onRename(newName)} 
          onToggleLock={() => onToggleLock(p.id)}
          indented
        />
      ))}
    </div>
  )
}

// ── Droppable Sidebar Floor ───────────────────────────────────────

function SidebarFloor({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'sidebar-floor',
    data: { type: 'floor' },
  })

  return (
    <div
      ref={setNodeRef}
      className="sidebar-floor"
      style={{
        flex: 1,
        minHeight: 40,
        outline: isOver ? '1px dashed var(--accent)' : 'none',
        margin: '4px',
      }}
    >
      {children}
    </div>
  )
}

// ── Drag Overlay Preview ──────────────────────────────────────────

function DragPreview({ palette }: { palette: Palette }) {
  return (
    <div className="palette-item active" style={{ opacity: 0.9, cursor: 'grabbing', width: 210 }}>
      <div className="palette-item-swatches">
        {palette.colors.slice(0, 5).map((c, i) => (
          <div key={i} className="palette-item-swatch" style={{ background: c.hex }} />
        ))}
      </div>
      <span className="palette-item-name">{palette.name}</span>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────

export function Sidebar({
  palettes,
  folders,
  selectedId,
  onSelect,
  onDelete,
  onDeleteFolder,
  onNewPalette,
  onNewFolder,
  onMutate,
}: SidebarProps) {
  const [activePalette, setActivePalette] = useState<Palette | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const sortedPalettes = [...palettes].sort((a, b) => {
    const ao = (a as any).order ?? 0
    const bo = (b as any).order ?? 0
    return ao - bo
  })
  const handleRenamePalette = (id: string, newName: string) =>
    onMutate('rename palette', () => renamePalette(id, newName))

  const handleToggleLock = (id: string) => {
    const locked = palettes.find(p => p.id === id)?.locked
    return onMutate(locked ? 'unlock palette' : 'lock palette', () =>
      togglePaletteLock(id),
    )
  }

  const handleRenameFolder = (oldName: string, newName: string) =>
    onMutate('rename folder', () => renameFolder(oldName, newName))

  const folderPalettes = (folder: string) =>
    sortedPalettes.filter(p => p.folder === folder)

  const unfoldered = sortedPalettes.filter(p => !p.folder)

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active
    if (data.current?.type === 'palette') {
      setActivePalette(data.current.palette)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActivePalette(null)
    if (!over) return

    const activeId = String(active.id)
    const activeData = active.data.current
    const overData = over.data.current

    // ── Dragging a palette ────────────────────────────────────────
    if (activeData?.type === 'palette') {
      const draggedPalette = palettes.find(p => p.id === activeId)
      if (!draggedPalette) return

      /** The palette ids, with `activeId` moved to sit where `targetId` was. */
      const reorderedAround = (targetId: string): string[] | null => {
        const ids = sortedPalettes.map(p => p.id)
        const oldIndex = ids.indexOf(activeId)
        const newIndex = ids.indexOf(targetId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null
        const reordered = [...ids]
        reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, activeId)
        return reordered
      }

      // Dropped onto a folder → move into folder
      if (overData?.type === 'folder') {
        const folderName = overData.name
        if (draggedPalette.folder !== folderName) {
          await onMutate('move palette', () => movePaletteToFolder(activeId, folderName))
        }
        return
      }

      // Dropped onto the floor or an unfoldered palette → unfolder
      if (overData?.type === 'floor' || (overData?.type === 'palette-drop' && !overData.palette?.folder)) {
        const leavingFolder = Boolean(draggedPalette.folder)
        const reordered =
          overData?.type === 'palette-drop' ? reorderedAround(overData.palette.id) : null
        if (!leavingFolder && !reordered) return

        // One drag is one undo step, even though it may take two storage calls.
        await onMutate(leavingFolder ? 'move palette' : 'reorder palettes', async () => {
          if (leavingFolder) await movePaletteToFolder(activeId, null)
          if (reordered) await reorderPalettes(reordered)
        })
        return
      }

      // Dropped onto a palette in the same folder → reorder
      if (overData?.type === 'palette-drop' && overData.palette?.folder === draggedPalette.folder) {
        const reordered = reorderedAround(overData.palette.id)
        if (reordered) {
          await onMutate('reorder palettes', () => reorderPalettes(reordered))
        }
        return
      }
    }

    // ── Dragging a folder ─────────────────────────────────────────
    if (activeData?.type === 'folder' && overData?.type === 'folder') {
      const activeName = activeData.name
      const overName = overData.name
      if (activeName === overName) return
      const oldIndex = folders.indexOf(activeName)
      const newIndex = folders.indexOf(overName)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...folders]
        reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, activeName)
        await onMutate('reorder folders', () => reorderFolders(reordered))
      }
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">Palettes</div>
      <div className="sidebar-list">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {folders.map((folder, index) => (
            <DroppableFolder
              key={folder}
              name={folder}
              tint={index % FOLDER_TINTS}
              palettes={folderPalettes(folder)}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={() => onDeleteFolder(folder)}
              onDeletePalette={onDelete}
              onRename={newName => handleRenameFolder(folder, newName)}
              onRenamePalette={handleRenamePalette}
              onToggleLock={handleToggleLock}
            />
          ))}

          <SidebarFloor>
            {unfoldered.map(p => (
              <DraggablePaletteItem
                key={p.id}
                palette={p}
                selected={p.id === selectedId}
                onSelect={() => onSelect(p.id)}
                onDelete={() => onDelete(p.id)}
                onRename={newName => handleRenamePalette(p.id, newName)}
                onToggleLock={() => handleToggleLock(p.id)}
              />
            ))}
          </SidebarFloor>

          <DragOverlay>
            {activePalette && <DragPreview palette={activePalette} />}
          </DragOverlay>

        </DndContext>

        {palettes.length === 0 && (
          <div className="empty-sidebar">
            no palettes yet —
            <br />
            your palettes will appear here
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <button className="btn btn-accent btn-full" onClick={onNewPalette}>
          + New Palette
        </button>
        <button className="btn btn-full" style={{ marginTop: 4 }} onClick={onNewFolder}>
          + New Folder
        </button>
      </div>
    </div>
  )
}