import { useState, useEffect } from 'react'

export default function useDebouncedSearch(initialValue = '', delay = 500) {
  const [search, setSearch] = useState(initialValue)
  const [debouncedSearch, setDebouncedSearch] = useState(initialValue)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), delay)
    return () => clearTimeout(timer)
  }, [search, delay])

  return { search, debouncedSearch, setSearch }
}
