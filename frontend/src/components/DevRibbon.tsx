const appMode = import.meta.env.VITE_APP_MODE

export function DevRibbon() {
  if (appMode !== 'development') return null

  return (
    <div className="fixed top-0 right-0 z-[9999] overflow-hidden pointer-events-none" style={{ width: 120, height: 120 }}>
      <div
        className="absolute bg-yellow-400 text-yellow-900 font-bold text-xs text-center tracking-widest uppercase"
        style={{
          width: 160,
          top: 28,
          right: -40,
          transform: 'rotate(45deg)',
          padding: '4px 0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        Dev
      </div>
    </div>
  )
}
