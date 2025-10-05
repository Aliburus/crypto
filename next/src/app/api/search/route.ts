import { NextRequest, NextResponse } from "next/server";

const DEMO_API_KEY = process.env.API_KEY ?? "";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("query") ?? "").trim();
    if (!q) {
      return NextResponse.json({ error: "missing_query" }, { status: 400 });
    }
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
      q
    )}`;
    const r = await fetch(url, {
      headers: { "x-cg-demo-api-key": DEMO_API_KEY },
      next: { revalidate: 0 },
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    return NextResponse.json(
      { error: "proxy_failed", message: String(err) },
      { status: 500 }
    );
  }
}



