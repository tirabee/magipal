import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
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
import { reorderPalettes, reorderFolders, movePaletteToFolder } from './storage'

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
  onUpdated: () => void
}

// ── Draggable Palette Item ────────────────────────────────────────

function DraggablePaletteItem({ palette, selected, onSelect, onDelete, indented, isOver }: {
  palette: Palette
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  indented?: boolean
  isOver?: boolean
}) {
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
      ].join(' ')}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      onClick={onSelect}
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
      <span className="palette-item-name">{palette.name}</span>
      <button
        className="palette-delete"
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete palette"
      >×</button>
    </div>
  )
}

// ── Droppable Folder ──────────────────────────────────────────────

function DroppableFolder({ name, palettes, selectedId, onSelect, onDelete, onDeletePalette }: {
  name: string
  palettes: Palette[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: () => void
  onDeletePalette: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${name}`,
    data: { type: 'folder', name },
  })

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `folder-drag:${name}`,
    data: { type: 'folder', name },
  })

  return (
    <div style={{ opacity: isDragging ? 0.3 : 1 }}>
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
        <span className="folder-name">{name}</span>
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
  onUpdated,
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
    const overId = String(over.id)
    const activeData = active.data.current
    const overData = over.data.current

    // ── Dragging a palette ────────────────────────────────────────
    if (activeData?.type === 'palette') {
      const draggedPalette = palettes.find(p => p.id === activeId)
      if (!draggedPalette) return

      // Dropped onto a folder → move into folder
      if (overData?.type === 'folder') {
        const folderName = overData.name
        if (draggedPalette.folder !== folderName) {
          await movePaletteToFolder(activeId, folderName)
          onUpdated()
        }
        return
      }

      // Dropped onto the floor or an unfoldered palette → unfolder
      if (overData?.type === 'floor' || (overData?.type === 'palette-drop' && !overData.palette?.folder)) {
        if (draggedPalette.folder) {
          await movePaletteToFolder(activeId, null)
          onUpdated()
        }
        // Also reorder if dropped onto a specific palette
        if (overData?.type === 'palette-drop') {
          const targetId = overData.palette.id
          const ids = sortedPalettes.map(p => p.id)
          const oldIndex = ids.indexOf(activeId)
          const newIndex = ids.indexOf(targetId)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = [...ids]
            reordered.splice(oldIndex, 1)
            reordered.splice(newIndex, 0, activeId)
            await reorderPalettes(reordered)
            onUpdated()
          }
        }
        return
      }

      // Dropped onto a palette in the same folder → reorder
      if (overData?.type === 'palette-drop' && overData.palette?.folder === draggedPalette.folder) {
        const targetId = overData.palette.id
        const ids = sortedPalettes.map(p => p.id)
        const oldIndex = ids.indexOf(activeId)
        const newIndex = ids.indexOf(targetId)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = [...ids]
          reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, activeId)
          await reorderPalettes(reordered)
          onUpdated()
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
        await reorderFolders(reordered)
        onUpdated()
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
          {folders.map(folder => (
            <DroppableFolder
              key={folder}
              name={folder}
              palettes={folderPalettes(folder)}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={() => onDeleteFolder(folder)}
              onDeletePalette={onDelete}
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
              />
            ))}
          </SidebarFloor>

          <DragOverlay>
            {activePalette && <DragPreview palette={activePalette} />}
          </DragOverlay>

        </DndContext>

        {palettes.length === 0 && (
          <div className="empty-sidebar">no palettes yet</div>
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