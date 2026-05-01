import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import Contractor from "@/lib/models/Contractor";
import IfcSession from "@/lib/models/IfcSession";
import IfcVersion from "@/lib/models/IfcVersion";
import { serializeIfcSession } from "@/lib/ifc/serializers";

function getCompanyId(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
  if (!payload || payload.role !== "company") return null;
  return payload.id;
}

export async function GET(req: Request) {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const contractors = await Contractor.find({ companyId }).select("_id");
    const contractorIds = contractors.map((contractor) => contractor._id);
    const sessions = await IfcSession.find({
      contractorId: { $in: contractorIds },
      status: "active",
    }).sort({ updatedAt: -1 });

    const sessionIds = sessions.map((session) => session._id);
    const versionAgg = await IfcVersion.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $group: { _id: "$sessionId", count: { $sum: 1 } } },
    ]);
    const versionMap = new Map<string, number>();
    for (const row of versionAgg) {
      versionMap.set(row._id.toString(), row.count);
    }

    return NextResponse.json({
      sessions: sessions.map((session) =>
        serializeIfcSession(session, versionMap.get(session._id.toString()) || 0)
      ),
    });
  } catch (error) {
    console.error("[API/company/ifc/sessions][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
