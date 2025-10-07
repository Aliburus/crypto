"use client";
import React from "react";
import { parseFlexibleNumber, formatUsdPrice } from "../../utils/number";

type Holding = { id: string; amount: number };

export default function BalancePage() {
  const [isMounted, setIsMounted] = React.useState<boolean>(false);
  const [favorites, setFavorites] = React.useState<
    { id: string; name?: string; symbol?: string; thumb?: string }[]
  >([]);
  const [holdings, setHoldings] = React.useState<Holding[]>([]);
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  const [countdown, setCountdown] = React.useState<string>("");
  const [usdTry, setUsdTry] = React.useState<number>(0);
  const [baseline, setBaseline] = React.useState<{
    ts: number;
    total: number;
  } | null>(null);
  const [dailyDeltaPct, setDailyDeltaPct] = React.useState<number>(0);
  const [dailyDeltaAbs, setDailyDeltaAbs] = React.useState<number>(0);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setIsMounted(true);
    try {
      const favRaw = localStorage.getItem("favorites");
      if (favRaw) setFavorites(JSON.parse(favRaw));
    } catch {}
    try {
      const holdRaw = localStorage.getItem("holdings");
      if (holdRaw) setHoldings(JSON.parse(holdRaw));
    } catch {}
    try {
      const raw = localStorage.getItem("dailyBaseline");
      if (raw) setBaseline(JSON.parse(raw));
    } catch {}
  }, []);

  // Do not persist holdings to localStorage; persistence handled via Mongo snapshots

  React.useEffect(() => {
    if (!isMounted) return;
    const ids = new Set(favorites.map((f) => f.id));
    setHoldings((prev) => {
      const map = new Map(prev.map((h) => [h.id, h]));
      ids.forEach((id) => {
        if (!map.has(id)) map.set(id, { id, amount: 0 });
      });
      return Array.from(map.values());
    });
  }, [isMounted, favorites]);

  // On first mount, hydrate holdings from latest Mongo snapshot if available
  React.useEffect(() => {
    if (!isMounted) return;
    const loadLatest = async () => {
      try {
        const r = await fetch("/api/balance", { cache: "no-store" });
        const data = (await r.json()) as {
          snapshots?: Array<{ holdings: { id: string; amount: number }[] }>;
        };
        const latest = data?.snapshots?.[0];
        if (
          latest &&
          Array.isArray(latest.holdings) &&
          latest.holdings.length > 0
        ) {
          setHoldings(
            latest.holdings.map((h) => ({
              id: h.id,
              amount: Number(h.amount) || 0,
            }))
          );
        }
      } catch {}
    };
    void loadLatest();
  }, [isMounted]);

  React.useEffect(() => {
    const load = async () => {
      const ids = holdings.map((h) => h.id).filter(Boolean);
      if (ids.length === 0) {
        setPrices({});
        try {
          const xr = await fetch(`/api/price?ids=tether&vs_currencies=try`);
          const xdata = await xr.json();
          const rate = Number(xdata?.tether?.try ?? 0);
          if (Number.isFinite(rate)) setUsdTry(rate);
        } catch {}
        return;
      }
      const r = await fetch(
        `/api/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`
      );
      const data = (await r.json()) as Record<string, { usd?: number }>;
      const pm: Record<string, number> = {};
      Object.keys(data).forEach((id) => {
        pm[id] = data[id]?.usd ?? 0;
      });
      setPrices(pm);
      // save server-side cache for quick hydration on reload
      void fetch("/api/price-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices: pm }),
      });
      // no local cache
      const now = Date.now();
      setLastUpdated(now);
      try {
        localStorage.setItem("priceLast_balance", String(now));
      } catch {}
      try {
        const xr = await fetch(`/api/price?ids=tether&vs_currencies=try`);
        const xdata = (await xr.json()) as { tether?: { try?: number } };
        const rate = Number(xdata?.tether?.try ?? 0);
        if (Number.isFinite(rate)) setUsdTry(rate);
      } catch {}
    };
    const checkAndLoad = () => {
      const ts = lastUpdated ?? 0;
      if (!ts || Date.now() - ts >= 900000) {
        load();
      }
    };
    if (isMounted) checkAndLoad();
    const t = setInterval(checkAndLoad, 30000);
    const handler = () => load();
    window.addEventListener("manual-refresh", handler as EventListener);
    return () => {
      clearInterval(t);
      window.removeEventListener("manual-refresh", handler as EventListener);
    };
  }, [isMounted, holdings, lastUpdated]);

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

  // Compute total and prepare snapshot saver BEFORE effects that use it
  const total = React.useMemo(
    () =>
      holdings.reduce(
        (sum, h) => sum + (prices[h.id] ?? 0) * (h.amount || 0),
        0
      ),
    [holdings, prices]
  );

  const saveSnapshot = React.useCallback(async () => {
    try {
      const payload = { holdings, totalUsd: total };
      const r = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        // eslint-disable-next-line no-console
        console.error("snapshot_save_failed", r.status, t);
      }
    } catch {}
  }, [holdings, total]);

  // Debounced autosave to Mongo when holdings change
  React.useEffect(() => {
    if (!isMounted) return;
    const t = setTimeout(() => {
      void saveSnapshot();
    }, 1000);
    return () => clearTimeout(t);
  }, [isMounted, holdings, saveSnapshot]);

  // Save snapshot every 15m and on manual refresh
  React.useEffect(() => {
    if (!isMounted) return;
    const ts = 0;
    if (!ts || Date.now() - ts >= 900000) {
      void saveSnapshot();
    }
    const handler = () => {
      void saveSnapshot();
    };
    window.addEventListener("manual-refresh", handler as EventListener);
    return () =>
      window.removeEventListener("manual-refresh", handler as EventListener);
  }, [isMounted, saveSnapshot]);
  const favoriteById = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; name?: string; symbol?: string; thumb?: string }
    >();
    favorites.forEach((f) => map.set(f.id, f));
    return map;
  }, [favorites]);

  React.useEffect(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let base = baseline;
    if (!base) {
      base = { ts: now, total };
      setBaseline(base);
      localStorage.setItem("dailyBaseline", JSON.stringify(base));
    } else if (now - base.ts >= dayMs) {
      base = { ts: now, total };
      setBaseline(base);
      localStorage.setItem("dailyBaseline", JSON.stringify(base));
    }
    if (base && base.total > 0) {
      const abs = total - base.total;
      const pct = (abs / base.total) * 100;
      setDailyDeltaAbs(abs);
      setDailyDeltaPct(pct);
    } else {
      setDailyDeltaAbs(0);
      setDailyDeltaPct(0);
    }
  }, [total]);

  const [hidden, setHidden] = React.useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem("hideBalances") || "false");
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    localStorage.setItem("hideBalances", JSON.stringify(hidden));
  }, [hidden]);

  if (!isMounted) {
    return <div className="price">Loading…</div>;
  }
  return (
    <div>
      <div
        className="section-title"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ flex: 1 }}>Balance</span>
        <button
          className="btn ghost"
          aria-label={hidden ? "Show balances" : "Hide balances"}
          onClick={() => setHidden((h) => !h)}
        >
          {hidden ? "👁" : "🙈"}
        </button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        Total: {hidden ? "••••" : `$${total.toLocaleString()}`}{" "}
        {usdTry > 0 && (
          <span style={{ color: "#9aa7bd", marginLeft: 12 }}>
            {hidden ? "••••" : `≈ ₺${(total * usdTry).toLocaleString()}`}
          </span>
        )}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Coin</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Price (USD)</th>
              <th style={{ textAlign: "right" }}>Value (USD)</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id}>
                <td>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {favoriteById.get(h.id)?.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={favoriteById.get(h.id)!.thumb}
                        alt=""
                        width={20}
                        height={20}
                        style={{ borderRadius: 999 }}
                      />
                    )}
                    <div>
                      <div style={{ color: "#e6ebf5", fontWeight: 600 }}>
                        {favoriteById.get(h.id)?.name ?? h.id}
                      </div>
                      {favoriteById.get(h.id)?.symbol && (
                        <div className="price">
                          ({favoriteById.get(h.id)!.symbol})
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={drafts[h.id] ?? String(h.amount)}
                    onChange={(e) => {
                      const nextRaw = e.target.value;
                      setDrafts((prev) => ({ ...prev, [h.id]: nextRaw }));
                      const parsed = parseFlexibleNumber(nextRaw);
                      if (parsed !== null) {
                        const amt = parsed;
                        setHoldings((prev) =>
                          prev.map((x) =>
                            x.id === h.id ? { ...x, amount: amt } : x
                          )
                        );
                      }
                    }}
                    onBlur={() => {
                      const raw = drafts[h.id];
                      const parsed =
                        raw != null ? parseFlexibleNumber(raw) : h.amount;
                      const amt = parsed ?? 0;
                      setHoldings((prev) =>
                        prev.map((x) =>
                          x.id === h.id ? { ...x, amount: amt } : x
                        )
                      );
                      setDrafts((prev) => {
                        const { [h.id]: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    style={{ width: 140, textAlign: "right" }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  {formatUsdPrice(prices[h.id] ?? 0)}
                </td>
                <td style={{ textAlign: "right" }}>
                  {hidden
                    ? "••••"
                    : formatUsdPrice((prices[h.id] ?? 0) * (h.amount || 0))}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setHoldings((prev) => prev.filter((x) => x.id !== h.id));
                      setFavorites((prev) => prev.filter((f) => f.id !== h.id));
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
