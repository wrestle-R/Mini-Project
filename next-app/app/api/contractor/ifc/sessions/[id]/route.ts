import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import IfcSession from "@/lib/models/IfcSession";
import IfcChatMessage from "@/lib/models/IfcChatMessage";
import IfcVersion from "@/lib/models/IfcVersion";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import { serializeIfcSession } from "@/lib/ifc/serializers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const contractorId = getContractorIdFromAuthHeader(
      req.headers.get("authorization")
    );
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    await dbConnect();
    const session = await IfcSession.findOne({
      _id: new mongoose.Types.ObjectId(id),
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [messages, versions] = await Promise.all([
      IfcChatMessage.find({ sessionId: session._id }).sort({ timestamp: 1 }),
      IfcVersion.find({ sessionId: session._id })
        .sort({ versionNumber: -1 })
        .select("versionNumber label createdAt"),
    ]);

    return NextResponse.json({
      session: serializeIfcSession(session, versions.length),
      messages: messages.map((message) => ({
        id: message._id.toString(),
        role: message.role,
        content: message.content,
        explanation: message.explanation || undefined,
        plan: message.plan || [],
        actions: message.actions || [],
        error: message.error || undefined,
        timestamp: message.timestamp,
      })),
      versions: versions.map((version) => ({
        id: version._id.toString(),
        versionNumber: version.versionNumber,
        label: version.label,
        createdAt: version.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API/contractor/ifc/sessions/:id][GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
