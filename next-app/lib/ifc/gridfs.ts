import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error("Mongo connection is not initialized");
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: "ifc_assets" });
}

export async function uploadBufferToGridFS(params: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}) {
  const bucket = getBucket();
  const sourceStream = Readable.from(params.buffer);
  const uploadStream = bucket.openUploadStream(params.filename, {
    contentType: params.contentType,
    metadata: params.metadata,
  });

  await new Promise<void>((resolve, reject) => {
    sourceStream
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => resolve());
  });

  return uploadStream.id.toString();
}

export async function downloadGridFSFileAsBuffer(fileId: string) {
  const bucket = getBucket();
  const stream = bucket.openDownloadStream(new ObjectId(fileId));
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    stream
      .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      .on("error", reject)
      .on("end", () => resolve());
  });

  return Buffer.concat(chunks);
}

export async function getGridFSFileInfo(fileId: string) {
  const bucket = getBucket();
  const cursor = bucket.find({ _id: new ObjectId(fileId) }).limit(1);
  const files = await cursor.toArray();
  return files[0] || null;
}

export async function deleteGridFSFiles(fileIds: string[]) {
  const bucket = getBucket();
  const uniqueIds = [...new Set(fileIds)].filter((id) => ObjectId.isValid(id));

  await Promise.all(
    uniqueIds.map(async (fileId) => {
      try {
        await bucket.delete(new ObjectId(fileId));
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("FileNotFound")) {
          throw error;
        }
      }
    })
  );
}
