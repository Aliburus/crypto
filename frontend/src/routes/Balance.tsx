import React from "react";
import { parseFlexibleNumber, formatLocaleNumber } from "../utils/number";
import { formatUsdPrice } from "../utils/number";
// removed page-local SearchBar; global header search remains

type Holding = { id: string; amount: number };

function useFavorites() {
  const [favorites, setFavorites] = React.useState<
    { id: string; name?: string; symbol?: string; thumb?: string }[]
  >(() => {
    const raw = localStorage.getItem("favorites");
    return raw ? JSON.parse(raw) : [];
  });
  const add = (
    id: string,
    extra?: { name?: string; symbol?: string; thumb?: string }
  ) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === id)) return prev;
      const next = [...prev, { id, ...extra }];
      localStorage.setItem("favorites", JSON.stringify(next));
      return next;
    });
  };
  const remove = (id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      localStorage.setItem("favorites", JSON.stringify(next));
      return next;
    });
  };
  return { favorites, add, remove };
}

function useHoldings() {
  const [holdings, setHoldings] = React.useState<Holding[]>(() => {
    const raw = localStorage.getItem("holdings");
    return raw ? JSON.parse(raw) : [];
  });
  React.useEffect(() => {
    localStorage.setItem("holdings", JSON.stringify(holdings));
  }, [holdings]);
  return { holdings, setHoldings };
}

export const Balance: React.FC = () => {
  const {
    favorites,
    add: addFavorite,
    remove: removeFavorite,
  } = useFavorites();
  const { holdings, setHoldings } = useHoldings();
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
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("dailyBaseline");
      if (raw) setBaseline(JSON.parse(raw));
    } catch {}
  }, []);
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

  React.useEffect(() => {
    // initialize holdings with 0 for favorites not present
    const ids = new Set(favorites.map((f) => f.id));
    setHoldings((prev) => {
      const map = new Map(prev.map((h) => [h.id, h]));
      ids.forEach((id) => {
        if (!map.has(id)) map.set(id, { id, amount: 0 });
      });
      return Array.from(map.values());
    });
  }, []);

  React.useEffect(() => {
    const load = async () => {
      const ids = holdings.map((h) => h.id).filter(Boolean);
      if (ids.length === 0) {
        setPrices({});
        // still fetch USD->TRY rate for Total TL display
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
      const data = await r.json();
      const pm: Record<string, number> = {};
      Object.keys(data).forEach((id) => {
        pm[id] = data[id]?.usd ?? 0;
      });
      setPrices(pm);
      try {
        localStorage.setItem("priceCache_balance", JSON.stringify(pm));
      } catch {}
      const now = Date.now();
      setLastUpdated(now);
      try {
        localStorage.setItem("priceLast_balance", String(now));
      } catch {}

      // fetch USD->TRY using tether (USDT) as proxy
      try {
        const xr = await fetch(`/api/price?ids=tether&vs_currencies=try`);
        const xdata = await xr.json();
        const rate = Number(xdata?.tether?.try ?? 0);
        if (Number.isFinite(rate)) setUsdTry(rate);
      } catch {}
    };
    // only fetch if 15m passed or manual refresh
    const checkAndLoad = () => {
      const ts =
        lastUpdated ?? Number(localStorage.getItem("priceLast_balance") || 0);
      if (!ts || Date.now() - ts >= 900000) {
        load();
      }
    };
    checkAndLoad();
    const t = setInterval(checkAndLoad, 30000); // check every 30s
    const handler = () => load();
    window.addEventListener("manual-refresh", handler as EventListener);
    return () => {
      clearInterval(t);
      window.removeEventListener("manual-refresh", handler as EventListener);
    };
  }, [holdings]);

  React.useEffect(() => {
    // hydrate cached prices to avoid blanks
    try {
      const raw = localStorage.getItem("priceCache_balance");
      if (raw) {
        const cached = JSON.parse(raw) as Record<string, number>;
        setPrices((prev) => ({ ...cached, ...prev }));
      }
    } catch {}
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

  const total = holdings.reduce(
    (sum, h) => sum + (prices[h.id] ?? 0) * (h.amount || 0),
    0
  );
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
      {/* page-local search removed; use global header search */}
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        Total: {hidden ? "••••" : `$${total.toLocaleString()}`}{" "}
        {usdTry > 0 && (
          <span style={{ color: "#9aa7bd", marginLeft: 12 }}>
            {hidden ? "••••" : `≈ ₺${(total * usdTry).toLocaleString()}`}
          </span>
        )}
      </div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {favoriteById.get(h.id)?.thumb && (
                    <img
                      src={favoriteById.get(h.id)!.thumb}
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
                  value={String(h.amount)}
                  onChange={(e) => {
                    const parsed = parseFlexibleNumber(e.target.value);
                    const amt = parsed ?? 0;
                    setHoldings((prev) =>
                      prev.map((x) =>
                        x.id === h.id ? { ...x, amount: amt } : x
                      )
                    );
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
                    // remove from holdings
                    setHoldings((prev) => {
                      const next = prev.filter((x) => x.id !== h.id);
                      localStorage.setItem("holdings", JSON.stringify(next));
                      return next;
                    });
                    // also remove from favorites for consistency
                    removeFavorite(h.id);
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Chart removed as requested */}
    </div>
  );
};
