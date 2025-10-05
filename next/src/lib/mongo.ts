import { MongoClient, ServerApiVersion } from "mongodb";

let client: MongoClient | null = null;

export function getMongoClient(): MongoClient {
  const uri =
    process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URL (or MONGODB_URI/MONGO_URI) is not set");
  }
  if (client) return client;
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  return client;
}

export async function getDb(dbName: string) {
  const c = getMongoClient();
  await c.connect();
  return c.db(dbName);
}
