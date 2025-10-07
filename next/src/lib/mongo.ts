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
  const name =
    dbName ||
    process.env.MONGODB_DB ||
    process.env.MONGO_DB ||
    (() => {
      const uri =
        process.env.MONGO_URL ||
        process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        "";
      try {
        const path = uri.split("/").slice(3).join("/");
        const first = path.split("?")[0];
        return first || "app";
      } catch {
        return "app";
      }
    })();
  return c.db(name);
}
