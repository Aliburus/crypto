import React from "react";
import { formatUsdPrice } from "../utils/number";
import { useLocation } from "react-router-dom";

type Favorite = { id: string; name?: string; symbol?: string; thumb?: string };

function useFavorites() {
  const [favorites, setFavorites] = React.useState<Favorite[]>(() => {
    const raw = localStorage.getItem("favorites");
    return raw ? JSON.parse(raw) : [];
  });
  React.useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);
  const add = (
    id: string,
    extra?: { name?: string; symbol?: string; thumb?: string }
  ) =>
    setFavorites((prev) =>
      prev.some((f) => f.id === id) ? prev : [...prev, { id, ...extra }]
    );
  const remove = (id: string) =>
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  return { favorites, add, remove };
}

export const Favorites: React.FC = () => {
  const { favorites, add, remove } = useFavorites();
  const loc = useLocation();

  // support adding via query param from SearchBar
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const addId = url.searchParams.get("add");
    if (addId) {
      add(addId, {
        name: url.searchParams.get("name") || undefined,
        symbol: url.searchParams.get("symbol") || undefined,
        thumb: url.searchParams.get("thumb") || undefined,
      });
      url.searchParams.delete("add");
      url.searchParams.delete("name");
      url.searchParams.delete("symbol");
      url.searchParams.delete("thumb");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loc.key]);

  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  const [countdown, setCountdown] = React.useState<string>("");

  const loadPrices = React.useCallback(async () => {
    if (favorites.length === 0) {
      setPrices({});
      const now = Date.now();
      setLastUpdated(now);
      try {
        localStorage.setItem("priceLast", String(now));
      } catch {}
      return;
    }
    const ids = favorites.map((f) => f.id).join(",");
    const r = await fetch(
      `/api/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`
    );
    const data = await r.json();
    const map: Record<string, number> = {};
    Object.keys(data).forEach((id) => {
      map[id] = data[id]?.usd ?? 0;
    });
    setPrices(map);
    try {
      localStorage.setItem("priceCache", JSON.stringify(map));
    } catch {}
    const now = Date.now();
    setLastUpdated(now);
    try {
      localStorage.setItem("priceLast", String(now));
    } catch {}
  }, [favorites]);

  const loadPricesFor = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const r = await fetch(
      `/api/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`
    );
    const data = await r.json();
    const map: Record<string, number> = {};
    Object.keys(data).forEach((id) => {
      map[id] = data[id]?.usd ?? 0;
    });
    setPrices((prev) => ({ ...prev, ...map }));
    try {
      const raw = localStorage.getItem("priceCache");
      const cache = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const merged = { ...cache, ...map };
      localStorage.setItem("priceCache", JSON.stringify(merged));
    } catch {}
    const now = Date.now();
    setLastUpdated(now);
    try {
      localStorage.setItem("priceLast", String(now));
    } catch {}
  }, []);

  React.useEffect(() => {
    // hydrate from cache so UI doesn't show '-'
    try {
      const raw = localStorage.getItem("priceCache");
      if (raw) {
        const cached = JSON.parse(raw) as Record<string, number>;
        setPrices((prev) => ({ ...cached, ...prev }));
      }
      const ts = localStorage.getItem("priceLast");
      if (ts) setLastUpdated(Number(ts));
    } catch {}
    // If any favorite lacks a cached price, fetch only those once
    try {
      const raw = localStorage.getItem("priceCache");
      const cache = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const missing = favorites
        .map((f) => f.id)
        .filter((id) => cache[id] === undefined);
      if (missing.length > 0) {
        void loadPricesFor(missing);
      }
    } catch {}
    const tick = () => {
      const ts = lastUpdated ?? Number(localStorage.getItem("priceLast") || 0);
      if (!ts || Date.now() - ts >= 900000) {
        loadPrices();
      }
    };
    const t = setInterval(tick, 30000); // check every 30s
    const handler = () => loadPrices();
    window.addEventListener("manual-refresh", handler as EventListener);
    return () => {
      clearInterval(t);
      window.removeEventListener("manual-refresh", handler as EventListener);
    };
  }, [favorites, loadPrices, loadPricesFor, lastUpdated]);

  React.useEffect(() => {
    const tick = () => {
      if (!lastUpdated) {
        setCountdown("");
        return;
      }
      const elapsed = Date.now() - lastUpdated;
      const remainingMs = Math.max(0, 900000 - (elapsed % 900000));
      const mm = Math.floor(remainingMs / 60000)
        .toString()
        .padStart(2, "0");
      const ss = Math.floor((remainingMs % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setCountdown(`${mm}:${ss}`);
    };
    const i = setInterval(tick, 1000);
    tick();
    return () => clearInterval(i);
  }, [lastUpdated]);

  return (
    <div>
      <div
        className="section-title"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ flex: 1 }}>Favorites</span>
        {lastUpdated && (
          <span className="price" style={{ marginRight: 8 }}>
            Last: {new Date(lastUpdated).toLocaleTimeString()} · Next:{" "}
            {countdown}
          </span>
        )}
        <button className="btn ghost" onClick={loadPrices}>
          Refresh
        </button>
      </div>
      {favorites.length === 0 && <div className="price">No favorites yet.</div>}
      {favorites.map((f) => (
        <div key={f.id} className="fav-row">
          <div
            className="fav-id"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {f.thumb && (
              <img
                src={f.thumb}
                width={20}
                height={20}
                style={{ borderRadius: 999 }}
              />
            )}
            <span>{f.name ?? f.id}</span>
            {f.symbol && <span className="price">({f.symbol})</span>}
          </div>
          <div className="price">
            {prices[f.id] !== undefined ? formatUsdPrice(prices[f.id]) : "-"}
          </div>
          <button className="btn ghost" onClick={() => remove(f.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};
