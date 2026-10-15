export default function PageHeader({ title, subtitle, children }) {
  if (!children) return null
  return (
    <div className="flex items-center justify-end gap-3 mb-6">
      {children}
    </div>
  )
}
