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
const COLLECTION = process.env.MONGODB_COLLECTION || "crypto";

export async function GET() {
  try {
    const db = await getDb(DB_NAME);
    const docs = (await db
      .collection<Snapshot>(COLLECTION)
      .find({})
      .sort({ ts: -1 })
      .limit(10)
      .toArray()) as Snapshot[];
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
    const doc: Snapshot = {
      ts: new Date().toISOString(),
      holdings: body.holdings.map((h) => ({
        id: String(h.id),
        amount: Number(h.amount),
      })),
      totalUsd: Number(body.totalUsd) || 0,
    };
    const db = await getDb(DB_NAME);
    const col = db.collection<Snapshot>(COLLECTION);
    await col.insertOne(doc);
    // keep only last 10
    const olderDocs: Array<WithId<Snapshot>> = (await col
      .find({}, { projection: { _id: 1 } })
      .sort({ ts: -1 })
      .skip(10)
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
