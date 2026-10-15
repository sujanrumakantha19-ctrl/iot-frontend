import React, { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'

export default function CountdownModal({ visible, title, subtitle, duration = 10, onCancel }) {
  const [timeLeft, setTimeLeft] = useState(duration)

  useEffect(() => {
    if (!visible) return
    setTimeLeft(duration)

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onCancel?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [visible, duration, onCancel])

  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (timeLeft / duration) * circumference

  return (
    <Dialog
      visible={visible}
      onHide={() => onCancel?.()}
      closable={false}
      showHeader={false}
      draggable={false}
      className="w-[90vw] max-w-sm rounded-none border border-[var(--border-color)] shadow-2xl"
      contentClassName="p-6 bg-[var(--bg-card)] flex flex-col items-center justify-center space-y-5"
    >
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* SVG Circle Progress */}
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-[var(--border-light)]"
            strokeWidth="6"
            fill="transparent"
          />
          {/* Foreground circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-[var(--accent-primary)] transition-all duration-1000 ease-linear"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Countdown Text */}
        <div className="absolute text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
          {timeLeft}s
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] font-medium">{subtitle}</p>
      </div>

      <button
        onClick={() => onCancel?.()}
        className="px-4 py-1.5 border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-none text-xs font-semibold tracking-wide transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </Dialog>
  )
}
