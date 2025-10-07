import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/mongo";

type PriceCacheDoc = {
  _id: string;
  ts: string;
  prices: Record<string, number>;
};

const DB_NAME = process.env.MONGODB_DB || process.env.MONGO_DB || "app";
const COLLECTION = process.env.MONGODB_COLLECTION_PRICE || "price_cache";

export async function GET() {
  try {
    const db = await getDb(DB_NAME);
    const doc = (await db
      .collection<PriceCacheDoc>(COLLECTION)
      .findOne({ _id: "latest" })) as PriceCacheDoc | null;
    return NextResponse.json({
      prices: doc?.prices ?? {},
      ts: doc?.ts ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "db_read_failed", message: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prices: Record<string, number> };
    if (!body || typeof body !== "object" || !body.prices) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const db = await getDb(DB_NAME);
    const doc: PriceCacheDoc = {
      _id: "latest",
      ts: new Date().toISOString(),
      prices: body.prices,
    };
    await db
      .collection<PriceCacheDoc>(COLLECTION)
      .updateOne({ _id: "latest" }, { $set: doc }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_write_failed", message: String(err) },
      { status: 500 }
    );
  }
}
