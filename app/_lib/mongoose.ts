import "server-only";
import mongoose from "mongoose";

type MongooseGlobal = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseGlobal: MongooseGlobal | undefined;
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
  const mongodbUri = process.env.MONGODB_URI ?? "";
  if (!mongodbUri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongodbUri, {
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
