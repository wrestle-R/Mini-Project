import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import GisRankingPreference from "@/lib/models/GisRankingPreference";

const DEFAULT_WEIGHTS = {
  fit: 40,
  environment: 20,
  infrastructure: 25,
  utilization: 15,
};

function sanitizeWeights(input: unknown) {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    fit: Math.max(0, Math.min(100, Number(source.fit ?? DEFAULT_WEIGHTS.fit) || DEFAULT_WEIGHTS.fit)),
    environment: Math.max(0, Math.min(100, Number(source.environment ?? DEFAULT_WEIGHTS.environment) || DEFAULT_WEIGHTS.environment)),
    infrastructure: Math.max(0, Math.min(100, Number(source.infrastructure ?? DEFAULT_WEIGHTS.infrastructure) || DEFAULT_WEIGHTS.infrastructure)),
    utilization: Math.max(0, Math.min(100, Number(source.utilization ?? DEFAULT_WEIGHTS.utilization) || DEFAULT_WEIGHTS.utilization)),
  };
}

export async function GET(req: Request) {
  try {
    const contractorId = getContractorIdFromAuthHeader(req.headers.get("authorization"));
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const preference = await GisRankingPreference.findOne({
      contractorId: new mongoose.Types.ObjectId(contractorId),
    });

    return NextResponse.json({
      weights: preference?.weights || DEFAULT_WEIGHTS,
    });
  } catch (error) {
    console.error("[API/contractor/gis/preferences][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const contractorId = getContractorIdFromAuthHeader(req.headers.get("authorization"));
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const weights = sanitizeWeights(body?.weights);

    await dbConnect();

    const preference = await GisRankingPreference.findOneAndUpdate(
      { contractorId: new mongoose.Types.ObjectId(contractorId) },
      { $set: { weights } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      weights: preference.weights,
    });
  } catch (error) {
    console.error("[API/contractor/gis/preferences][PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
