"use client";
import React from "react";
import { formatUsdPrice } from "../utils/number";

type Favorite = { id: string; name?: string; symbol?: string; thumb?: string };
type FavoriteWithPrice = Favorite & { price?: number };

export default function FavoritesPage() {
  const [favorites, setFavorites] = React.useState<FavoriteWithPrice[]>([]);
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  const [countdown, setCountdown] = React.useState<string>("");
  const [isMounted, setIsMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    const init = async () => {
      let current: FavoriteWithPrice[] = [];
      try {
        const r = await fetch("/api/favorites", { cache: "no-store" });
        const data = (await r.json()) as { favorites?: FavoriteWithPrice[] };
        current = data.favorites ?? [];
      } catch {}
      const url = new URL(window.location.href);
      const addId = url.searchParams.get("add");
      if (addId) {
        const extra: Partial<FavoriteWithPrice> = {
          name: url.searchParams.get("name") || undefined,
          symbol: url.searchParams.get("symbol") || undefined,
          thumb: url.searchParams.get("thumb") || undefined,
        };
        if (!current.some((f) => f.id === addId)) {
          current = [...current, { id: addId, ...extra } as FavoriteWithPrice];
        }
        url.searchParams.delete("add");
        url.searchParams.delete("name");
        url.searchParams.delete("symbol");
        url.searchParams.delete("thumb");
        window.history.replaceState({}, "", url.toString());
      }
      setFavorites(current);
    };
    void init();
  }, []);

  // persist to Mongo whenever favorites change (debounced)
  React.useEffect(() => {
    const t = setTimeout(() => {
      void fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites }),
      });
    }, 400);
    return () => clearTimeout(t);
  }, [favorites]);

  const loadPrices = React.useCallback(async () => {
    if (favorites.length === 0) {
      setPrices({});
      const now = Date.now();
      setLastUpdated(now);
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
    // also update favorite documents with latest price in memory and persist
    setFavorites((prev) =>
      prev.map((f) => ({ ...f, price: map[f.id] } as FavoriteWithPrice))
    );
    void fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        favorites: favorites.map((f) => ({ ...f, price: map[f.id] })),
      }),
    });
    // save latest to server cache
    void fetch("/api/price-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices: map }),
    });
    const now = Date.now();
    setLastUpdated(now);
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
    const now = Date.now();
    setLastUpdated(now);
  }, []);

  React.useEffect(() => {
    // hydrate prices from server cache first
    const hydrate = async () => {
      try {
        const r = await fetch("/api/price-cache", { cache: "no-store" });
        const data = (await r.json()) as { prices?: Record<string, number> };
        if (data?.prices) setPrices((prev) => ({ ...data.prices, ...prev }));
      } catch {}
    };
    void hydrate();
    const missing = favorites
      .map((f) => f.id)
      .filter((id) => prices[id] === undefined);
    if (missing.length > 0) {
      void loadPricesFor(missing);
    }
    const tick = () => {
      const ts = lastUpdated ?? 0;
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
            Last:{" "}
            {new Date(lastUpdated).toLocaleTimeString("en-US", {
              timeZone: "UTC",
            })}{" "}
            · Next: {countdown}
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
