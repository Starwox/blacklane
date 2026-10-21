import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export interface DataState<T> {
  data: T | undefined
  error: unknown
  loading: boolean
  reload: () => Promise<void>
  setData: (v: T | ((prev: T | undefined) => T)) => void
}

/** Charge des données asynchrones avec gestion du chargement et des erreurs */
export function useData<T>(fetcher: () => Promise<T>, deps: DependencyList): DataState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps)

  const reload = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const v = await run()
      if (id === seq.current) setData(v)
    } catch (e) {
      if (id === seq.current) setError(e)
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload, setData: setData as DataState<T>['setData'] }
}
