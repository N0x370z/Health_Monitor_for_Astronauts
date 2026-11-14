import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_BASE ?? '';

export async function api(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

/** Carga datos de la API; se recarga cuando cambia `path` o cada `refreshMs`. */
export function useApi(path, refreshMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    const load = () =>
      api(path)
        .then((data) => alive && setState({ data, error: null, loading: false }))
        .catch((error) => alive && setState((s) => ({ ...s, error, loading: false })));
    setState((s) => ({ ...s, loading: true }));
    load();
    const timer = refreshMs ? setInterval(load, refreshMs) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [path, refreshMs]);
  return state;
}
