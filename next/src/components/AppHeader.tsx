"use client";
import Link from "next/link";
import { SearchBar } from "./SearchBar";

export function AppHeader() {
  return (
    <header className="app-header">
      <SearchBar
        onSelect={(coin) => {
          const url = `/?add=${encodeURIComponent(
            coin.id
          )}&name=${encodeURIComponent(coin.name)}&symbol=${encodeURIComponent(
            coin.symbol
          )}&thumb=${encodeURIComponent(coin.thumb ?? "")}`;
          window.location.href = url;
        }}
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
        <Link href="/">Favorites</Link>
        <Link href="/balance">Balance</Link>
      </nav>
    </header>
  );
}

