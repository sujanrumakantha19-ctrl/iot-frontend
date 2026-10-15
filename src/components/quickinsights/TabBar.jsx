import React, { useState, useRef, useEffect } from 'react'

export default function TabBar({
  tabs = [],
  activeTabId,
  onTabClick,
  onCreateTab,
  onRenameTab,
  onDeleteTab,
  editable = false,
  rightActions = null
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [targetTab, setTargetTab] = useState(null)
  const [tabNameInput, setTabNameInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Fixed positioning dropdown menu state
  const [activeMenu, setActiveMenu] = useState(null) // { tabId, top, left }

  const menuRef = useRef(null)
  const createInputRef = useRef(null)
  const renameInputRef = useRef(null)

  // Focus input when modals open
  useEffect(() => {
    if (createModalOpen && createInputRef.current) {
      setTimeout(() => createInputRef.current?.focus(), 100)
    }
  }, [createModalOpen])

  useEffect(() => {
    if (renameModalOpen && renameInputRef.current) {
      setTimeout(() => renameInputRef.current?.focus(), 100)
    }
  }, [renameModalOpen])

  // Close dropdown menu on outside click or scroll
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null)
      }
    }
    const handleScroll = () => setActiveMenu(null)

    if (activeMenu) {
      window.addEventListener('mousedown', handleOutside)
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        window.removeEventListener('mousedown', handleOutside)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [activeMenu])

  const handleOpenCreateModal = () => {
    setTabNameInput('')
    setErrorMessage('')
    setCreateModalOpen(true)
  }

  const handleConfirmCreate = (e) => {
    if (e) e.preventDefault()
    const trimmed = tabNameInput.trim()
    if (!trimmed) return

    // Duplicate check
    const isDuplicate = tabs.some(t => t.name.toLowerCase() === trimmed.toLowerCase())
    if (isDuplicate) {
      setErrorMessage(`A tab named "${trimmed}" already exists. Tab names must be unique.`)
      return
    }

    if (onCreateTab) {
      onCreateTab(trimmed)
    }
    setCreateModalOpen(false)
    setTabNameInput('')
    setErrorMessage('')
  }

  const handleOpenRenameModal = (tab) => {
    setTargetTab(tab)
    setTabNameInput(tab.name)
    setErrorMessage('')
    setActiveMenu(null)
    setRenameModalOpen(true)
  }

  const handleConfirmRename = (e) => {
    if (e) e.preventDefault()
    const trimmed = tabNameInput.trim()
    if (!trimmed) return

    // Duplicate check (excluding self)
    const isDuplicate = tabs.some(t => t._id !== targetTab._id && t.name.toLowerCase() === trimmed.toLowerCase())
    if (isDuplicate) {
      setErrorMessage(`A tab named "${trimmed}" already exists. Tab names must be unique.`)
      return
    }

    if (targetTab && onRenameTab) {
      onRenameTab(targetTab._id, trimmed)
    }
    setRenameModalOpen(false)
    setTargetTab(null)
    setTabNameInput('')
    setErrorMessage('')
  }

  const handleOpenDeleteModal = (tab) => {
    setTargetTab(tab)
    setActiveMenu(null)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = () => {
    if (targetTab && onDeleteTab) {
      onDeleteTab(targetTab._id)
    }
    setDeleteModalOpen(false)
    setTargetTab(null)
  }

  const handleToggleMenu = (e, tabId) => {
    e.stopPropagation()
    if (activeMenu && activeMenu.tabId === tabId) {
      setActiveMenu(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setActiveMenu({
        tabId,
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 160)
      })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      {/* ── Left: Sleek Horizontal Segmented Tab Bar Container ── */}
      <div
        className="flex-1 min-w-0 p-1.5 rounded-2xl border flex items-center gap-1.5 overflow-x-auto no-scrollbar"
        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
      >
        {tabs.map(tab => {
          const isActive = activeTabId === tab._id

          return (
            <div key={tab._id} className="relative shrink-0 flex items-center">
              <div
                className={`flex items-center h-[36px] rounded-xl text-xs transition-all ${
                  isActive
                    ? 'shadow-xs font-black border'
                    : 'font-bold hover:opacity-80'
                }`}
                style={isActive
                  ? { background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }
                  : { color: 'var(--text-primary)', opacity: 0.7 }
                }
              >
                {/* Main Tab Click Area */}
                <button
                  type="button"
                  onClick={() => onTabClick(tab._id)}
                  className="flex items-center gap-2 px-3.5 h-full border-none bg-transparent text-inherit font-inherit cursor-pointer outline-none"
                >
                  <span>{tab.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-inherit opacity-60'
                    }`}
                    style={!isActive ? { background: 'var(--bg-hover)' } : {}}
                  >
                    {tab.widgetCount || 0}
                  </span>
                </button>

                {/* 3-Dots Action Button */}
                {editable && isActive && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleMenu(e, tab._id)}
                    className="w-7 h-7 mr-1 rounded-lg flex items-center justify-center hover:opacity-80 transition-colors border-none bg-transparent cursor-pointer outline-none shrink-0"
                    style={{ color: 'var(--text-primary)' }}
                    title="Tab Options"
                  >
                    <i className="pi pi-ellipsis-v text-[10px]" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Fixed Positioning Dropdown Menu (No Overflow Contamination!) ── */}
      {activeMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-2xl shadow-xl border py-1.5 min-w-[150px] text-xs font-bold animate-fadeIn"
          style={{ top: `${activeMenu.top}px`, left: `${activeMenu.left}px`, background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          {(() => {
            const currentTab = tabs.find(t => t._id === activeMenu.tabId)
            if (!currentTab) return null
            return (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenRenameModal(currentTab)}
                  className="w-full text-left px-4 py-2 flex items-center gap-2.5 cursor-pointer border-none bg-transparent hover:opacity-80"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <i className="pi pi-pencil text-xs opacity-60" /> Rename Tab
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDeleteModal(currentTab)}
                  className="w-full text-left px-4 py-2 hover:bg-red-50/20 text-red-500 flex items-center gap-2.5 cursor-pointer border-none bg-transparent border-t"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <i className="pi pi-trash text-xs" /> Delete Tab
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* ── Right Pinned Actions Group ── */}
      <div className="shrink-0 flex items-center gap-2">
        {editable && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 h-[38px] rounded-xl text-xs font-extrabold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 transition-all cursor-pointer shadow-2xs"
            title="Create New Tab"
          >
            <i className="pi pi-plus text-xs" />
            <span>New Tab</span>
          </button>
        )}

        {rightActions}
      </div>

      {/* ── Create Tab Modal ── */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="rounded-3xl shadow-2xl border max-w-md w-full overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}
            >
              <h3 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Create New Tab</h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-colors border-none cursor-pointer"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Tab Name</label>
                <input
                  ref={createInputRef}
                  value={tabNameInput}
                  onChange={e => { setTabNameInput(e.target.value); setErrorMessage('') }}
                  placeholder="e.g. Vibration Suite, Motor Health..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-1 ${
                    errorMessage ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    borderColor: errorMessage ? undefined : 'var(--border-color)'
                  }}
                />
                {errorMessage && (
                  <p className="text-[11px] font-bold text-red-500 mt-1 flex items-center gap-1">
                    <i className="pi pi-exclamation-circle text-xs" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tabNameInput.trim()}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl cursor-pointer border-none shadow-xs"
                >
                  Create Tab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rename Tab Modal ── */}
      {renameModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setRenameModalOpen(false)}
        >
          <div
            className="rounded-3xl shadow-2xl border max-w-md w-full overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}
            >
              <h3 className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Rename Tab</h3>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-colors border-none cursor-pointer"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <form onSubmit={handleConfirmRename} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>New Tab Name</label>
                <input
                  ref={renameInputRef}
                  value={tabNameInput}
                  onChange={e => { setTabNameInput(e.target.value); setErrorMessage('') }}
                  placeholder="Tab name..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-1 ${
                    errorMessage ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    borderColor: errorMessage ? undefined : 'var(--border-color)'
                  }}
                />
                {errorMessage && (
                  <p className="text-[11px] font-bold text-red-500 mt-1 flex items-center gap-1">
                    <i className="pi pi-exclamation-circle text-xs" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tabNameInput.trim()}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl cursor-pointer border-none shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Tab Confirmation Modal ── */}
      {deleteModalOpen && targetTab && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="rounded-3xl shadow-2xl border max-w-md w-full overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}
            >
              <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <i className="pi pi-exclamation-triangle text-amber-500 text-base" />
                Delete Tab
              </h3>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-colors border-none cursor-pointer"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                Are you sure you want to delete the tab <strong>"{targetTab.name}"</strong>? All widgets configured inside this tab will be permanently removed.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl cursor-pointer border-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer border-none shadow-xs"
                >
                  Delete Tab
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
