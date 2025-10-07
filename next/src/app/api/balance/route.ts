import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/mongo";
import type { ObjectId, WithId } from "mongodb";

type Snapshot = {
  _id?: ObjectId;
  ts: string; // ISO string
  holdings: Array<{ id: string; amount: number }>;
  totalUsd: number;
};

// Let getDb infer DB name from connection URI when env not provided
const DB_NAME = process.env.MONGODB_DB || process.env.MONGO_DB || "";
const COLLECTION = process.env.MONGODB_COLLECTION || "crypto"; // history
const LATEST_COLLECTION =
  process.env.MONGODB_COLLECTION_LATEST || "crypto_latest";
const HISTORY_LIMIT =
  Number.parseInt(process.env.BALANCE_HISTORY_LIMIT || "10", 10) || 10;

export async function GET() {
  try {
    const db = await getDb(DB_NAME);
    const docs = (await db
      .collection<Snapshot>(COLLECTION)
      .find({})
      .sort({ ts: -1 })
      .limit(HISTORY_LIMIT)
      .toArray()) as Snapshot[];
    // Fallback: if history empty, try latest
    if (!docs || docs.length === 0) {
      const latest = (await db
        .collection<{ _id: string } & Snapshot>(LATEST_COLLECTION)
        .findOne({ _id: "latest" })) as (Snapshot & { _id: string }) | null;
      if (latest) {
        return NextResponse.json({ snapshots: [latest] });
      }
    }
    return NextResponse.json({ snapshots: docs });
  } catch (err) {
    return NextResponse.json(
      { error: "db_read_failed", message: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Snapshot;
    if (!body || !Array.isArray(body.holdings)) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    // Reject only when there are no holdings at all; allow zero amounts so
    // that newly added favorites are persisted and can be edited later
    const normalizedHoldings = body.holdings
      .map((h) => ({ id: String(h.id), amount: Number(h.amount) }))
      .filter((h) => h.id && !Number.isNaN(h.amount));
    if (normalizedHoldings.length === 0) {
      return NextResponse.json(
        { error: "empty_holdings", message: "No holdings provided" },
        { status: 400 }
      );
    }
    const doc: Snapshot = {
      ts: new Date().toISOString(),
      holdings: normalizedHoldings,
      totalUsd: Math.max(0, Number(body.totalUsd) || 0),
    };
    const db = await getDb(DB_NAME);
    const col = db.collection<Snapshot>(COLLECTION);
    // 1) Upsert latest snapshot separately
    await db
      .collection<{ _id: string } & Snapshot>(LATEST_COLLECTION)
      .updateOne({ _id: "latest" }, { $set: doc }, { upsert: true });
    // 2) Append to history
    await col.insertOne(doc);
    // keep only last HISTORY_LIMIT
    const olderDocs: Array<WithId<Snapshot>> = (await col
      .find({}, { projection: { _id: 1 } })
      .sort({ ts: -1 })
      .skip(HISTORY_LIMIT)
      .toArray()) as Array<WithId<Snapshot>>;
    if (olderDocs.length > 0) {
      const ids: ObjectId[] = olderDocs.map(
        (d) => d._id as unknown as ObjectId
      );
      await col.deleteMany({ _id: { $in: ids } });
    }
    return NextResponse.json({ ok: true, snapshot: doc }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "db_write_failed", message: String(err) },
      { status: 500 }
    );
  }
}
