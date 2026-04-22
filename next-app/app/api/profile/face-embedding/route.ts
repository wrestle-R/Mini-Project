import { NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Worker from "@/lib/models/Worker";
import FaceEmbedding from "@/lib/models/FaceEmbedding";
import { getPythonApiBase } from "@/lib/python-attendance";

async function getFirebaseUid(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const firebaseUid = await getFirebaseUid(req.headers.get("authorization"));
    if (!firebaseUid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const existing = await FaceEmbedding.findOne({ subjectType: "worker", subjectId: firebaseUid }).lean();
    return NextResponse.json({
      exists: Boolean(existing),
      embedding: existing
        ? {
            model: existing.embeddingModel,
            dim: existing.dim,
            version: existing.version,
            imageUrl: existing.imageUrl,
            updatedAt: existing.updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[GET /api/profile/face-embedding]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const firebaseUid = await getFirebaseUid(req.headers.get("authorization"));
    if (!firebaseUid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const worker = await Worker.findOne({ firebaseUid }).select("firebaseUid photoUrl");
    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    if (!worker.photoUrl) {
      return NextResponse.json({ error: "Upload profile photo first" }, { status: 400 });
    }

    const formData = new FormData();
    formData.append("employee_id", worker.firebaseUid);
    formData.append("image_url", worker.photoUrl);
    formData.append("allow_update", "true");

    const pythonResp = await fetch(`${getPythonApiBase()}/register_face_from_url`, {
      method: "POST",
      body: formData,
    });

    if (!pythonResp.ok) {
      const text = await pythonResp.text();
      return NextResponse.json(
        { error: "Face registration failed", detail: text },
        { status: 502 }
      );
    }

    const pythonData = (await pythonResp.json()) as {
      embedding?: number[];
      dim?: number;
    };

    const embedding = Array.isArray(pythonData.embedding) ? pythonData.embedding : [];
    const dim = Number(pythonData.dim ?? embedding.length ?? 0);

    const saved = await FaceEmbedding.findOneAndUpdate(
      { subjectType: "worker", subjectId: worker.firebaseUid },
      {
        $set: {
          imageUrl: worker.photoUrl,
          embedding,
          dim,
          embeddingModel: "facenet-pytorch",
          version: "vggface2-inceptionresnetv1",
          isActive: true,
        },
      },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({
      ok: true,
      embedding: {
        dim: saved?.dim ?? dim,
        model: saved?.embeddingModel ?? "facenet-pytorch",
        version: saved?.version ?? "vggface2-inceptionresnetv1",
        updatedAt: saved?.updatedAt,
      },
    });
  } catch (error) {
    console.error("[POST /api/profile/face-embedding]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
