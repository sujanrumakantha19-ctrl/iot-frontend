import { toast } from 'react-toastify'

export function showToast({ severity, summary, detail, life }) {
  const msg = summary ? `${summary}: ${detail}` : detail
  const options = life ? { autoClose: life } : {}

  switch (severity) {
    case 'error':
      return toast.error(msg, options)
    case 'success':
      return toast.success(msg, options)
    case 'warn':
      return toast.warning(msg, options)
    case 'info':
      return toast.info(msg, options)
    default:
      return toast(msg, options)
  }
}
