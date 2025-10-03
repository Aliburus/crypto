import React from "react";

type SearchResult = {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
};

export const SearchBar: React.FC<{
  onSelect: (coin: SearchResult) => void;
}> = ({ onSelect }) => {
  const [q, setQ] = React.useState<string>("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const search = React.useCallback(async () => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = await r.json();
      const coins = (data?.coins ?? []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        thumb: c.thumb,
      }));
      setResults(coins);
    } finally {
      setLoading(false);
    }
  }, [q]);

  // close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced live search while typing
  React.useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      search();
    }, 300);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div className="search-wrap" ref={containerRef}>
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") search();
        }}
        placeholder="Search coin..."
      />
      <button className="btn" onClick={search} disabled={loading}>
        Search
      </button>
      {results.length > 0 && (
        <div className="dropdown">
          {results.map((r) => (
            <div
              key={r.id}
              className="dropdown-item"
              onClick={() => {
                onSelect(r);
                setResults([]);
                setQ("");
              }}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {r.thumb && (
                  <img
                    src={r.thumb}
                    width={18}
                    height={18}
                    style={{ borderRadius: 999 }}
                  />
                )}
                {r.name} ({r.symbol})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
