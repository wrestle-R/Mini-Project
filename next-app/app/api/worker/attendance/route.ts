import { NextResponse } from "next/server";

async function verifyFirebaseToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      uid: payload.user_id || payload.sub,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const fbUser = await verifyFirebaseToken(authHeader);

  if (!fbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    attendance: [],
  });
}
