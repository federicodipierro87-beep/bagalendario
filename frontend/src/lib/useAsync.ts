import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

interface Result<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Carica dati asincroni. Ricarica quando cambia `key` (es. i filtri serializzati) o con `reload()`.
 * Durante il ricaricamento restano visibili i dati precedenti.
 */
export function useAsync<T>(loader: () => Promise<T>, key = '') {
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const [tick, setTick] = useState(0);
  const requestKey = `${key}#${tick}`;
  const [result, setResult] = useState<Result<T>>({ key: '', data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    loaderRef.current().then(
      (data) => !cancelled && setResult({ key: requestKey, data, error: null }),
      (err) => !cancelled && setResult((prev) => ({ key: requestKey, data: prev.data, error: errorMessage(err) })),
    );
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setResult((prev) => ({ ...prev, data })), []);

  return {
    data: result.data,
    error: result.error,
    loading: result.key !== requestKey,
    reload,
    setData,
  };
}
