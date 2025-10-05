import { NextResponse } from "next/server";

const DEMO_API_KEY = process.env.API_KEY ?? "";

export async function GET() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/ping", {
      headers: { "x-cg-demo-api-key": DEMO_API_KEY },
      // Revalidate frequently to avoid caching
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



