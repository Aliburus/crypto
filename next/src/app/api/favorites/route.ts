import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/mongo";

type Favorite = {
  id: string;
  name?: string;
  symbol?: string;
  thumb?: string;
  price?: number; // optional cached price to show immediately
};

// Let getDb infer DB name from connection URI when env not provided
const DB_NAME = process.env.MONGODB_DB || process.env.MONGO_DB || "";
const COLLECTION = process.env.MONGODB_COLLECTION_FAVS || "favorites";

export async function GET() {
  try {
    const db = await getDb(DB_NAME);
    const docs = await db
      .collection<{ _id: string; favorites: Favorite[] }>(COLLECTION)
      .findOne({ _id: "default" });
    return NextResponse.json({ favorites: docs?.favorites ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: "db_read_failed", message: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { favorites: Favorite[] };
    if (!body || !Array.isArray(body.favorites)) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    // Do not overwrite with an empty list; require at least one favorite id
    const cleaned = body.favorites
      .map((f) => ({
        id: String(f.id),
        name: f.name,
        symbol: f.symbol,
        thumb: f.thumb,
        price: typeof f.price === "number" ? f.price : undefined,
      }))
      .filter((f) => !!f.id);
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: "empty_favorites", message: "Favorites list cannot be empty" },
        { status: 400 }
      );
    }
    const db = await getDb(DB_NAME);
    await db
      .collection<{ _id: string; favorites: Favorite[] }>(COLLECTION)
      .updateOne(
        { _id: "default" },
        { $set: { favorites: cleaned } },
        { upsert: true }
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_write_failed", message: String(err) },
      { status: 500 }
    );
  }
}
