import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { SearchBar } from "../ui/SearchBar";

export const App: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="container">
      <header className="app-header">
        <SearchBar
          onSelect={(coin) =>
            navigate(
              `/?add=${encodeURIComponent(coin.id)}&name=${encodeURIComponent(
                coin.name
              )}&symbol=${encodeURIComponent(
                coin.symbol
              )}&thumb=${encodeURIComponent((coin as any).thumb ?? "")}`
            )
          }
        />
        <nav className="nav">
          <button
            className="btn ghost"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("manual-refresh"))
            }
          >
            Refresh
          </button>
          <Link to="/">Favorites</Link>
          <Link to="/balance">Balance</Link>
        </nav>
      </header>
      <div className="card" style={{ padding: 16 }}>
        <Outlet />
      </div>
    </div>
  );
};
