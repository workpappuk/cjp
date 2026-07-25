import "server-only";
import mongoose from "mongoose";

type MongooseGlobal = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseGlobal: MongooseGlobal | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI ?? "";

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseGlobal?: MongooseGlobal;
};

const cached = globalForMongoose.mongooseGlobal ?? {
  conn: null,
  promise: null,
};

globalForMongoose.mongooseGlobal = cached;

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB,
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
