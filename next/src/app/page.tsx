"use client";
import React from "react";
import { formatUsdPrice } from "../utils/number";

type Favorite = { id: string; name?: string; symbol?: string; thumb?: string };

export default function FavoritesPage() {
  const [favorites, setFavorites] = React.useState<Favorite[]>(() => {
    try {
      const raw = localStorage.getItem("favorites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  const [countdown, setCountdown] = React.useState<string>("");
  const [isMounted, setIsMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const addId = url.searchParams.get("add");
    if (addId) {
      const extra = {
        name: url.searchParams.get("name") || undefined,
        symbol: url.searchParams.get("symbol") || undefined,
        thumb: url.searchParams.get("thumb") || undefined,
      };
      setFavorites((prev) =>
        prev.some((f) => f.id === addId)
          ? prev
          : [...prev, { id: addId, ...extra }]
      );
      url.searchParams.delete("add");
      url.searchParams.delete("name");
      url.searchParams.delete("symbol");
      url.searchParams.delete("thumb");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

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
    const data = (await r.json()) as Record<string, { usd?: number }>;
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
    const data = (await r.json()) as Record<string, { usd?: number }>;
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
    try {
      const raw = localStorage.getItem("priceCache");
      if (raw) {
        const cached = JSON.parse(raw) as Record<string, number>;
        setPrices((prev) => ({ ...cached, ...prev }));
      }
      const ts = localStorage.getItem("priceLast");
      if (ts) setLastUpdated(Number(ts));
    } catch {}
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
    const t = setInterval(tick, 30000);
    const handler = () => loadPrices();
    window.addEventListener("manual-refresh", handler as EventListener);
    return () => {
      clearInterval(t);
      window.removeEventListener("manual-refresh", handler as EventListener);
    };
  }, [favorites, loadPrices, loadPricesFor, lastUpdated]);

  React.useEffect(() => {
    setIsMounted(true);
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
        {isMounted && lastUpdated && (
          <span
            className="price"
            style={{ marginRight: 8 }}
            suppressHydrationWarning
          >
            Last: {new Date(lastUpdated).toLocaleTimeString("en-US", { timeZone: "UTC" })} · Next:{" "}
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.thumb}
                alt=""
                width={20}
                height={20}
                style={{ borderRadius: 999 }}
              />
            )}
            <span>{f.name ?? f.id}</span>
            {f.symbol && <span className="price">({f.symbol})</span>}
          </div>
          <div className="price">
            {prices[f.id] !== undefined
              ? formatUsdPrice(prices[f.id] ?? 0)
              : "-"}
          </div>
          <button
            className="btn ghost"
            onClick={() =>
              setFavorites((prev) => prev.filter((x) => x.id !== f.id))
            }
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
