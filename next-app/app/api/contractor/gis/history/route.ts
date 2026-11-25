import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { getContractorIdFromAuthHeader } from "@/lib/ifc/auth";
import GisValidationSnapshot from "@/lib/models/GisValidationSnapshot";
import ProjectReport from "@/lib/models/ProjectReport";
import IfcSession from "@/lib/models/IfcSession";

function avg(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export async function GET(req: Request) {
  try {
    const contractorId = getContractorIdFromAuthHeader(req.headers.get("authorization"));
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const contractorObjectId = new mongoose.Types.ObjectId(contractorId);
    const [snapshots, reports, sessions] = await Promise.all([
      GisValidationSnapshot.find({ contractorId: contractorObjectId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      ProjectReport.find({ contractorId: contractorObjectId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      IfcSession.find({ contractorId: contractorObjectId }).select("_id title workflowState").lean(),
    ]);

    const sessionTitleMap = new Map(sessions.map((session) => [session._id.toString(), session.title]));
    const reportBySnapshotId = new Map(reports.map((report) => [report.validationSnapshotId.toString(), report]));

    const fitScores: number[] = [];
    const envScores: number[] = [];
    const infraScores: number[] = [];
    const utilizationRatios: number[] = [];
    const successfulAnalyses: Array<{
      id: string;
      sessionTitle: string;
      fitScore: number;
      environmentalScore: number | null;
      infrastructureScore: number | null;
      estimatedDurationDays: number | null;
      totalBudget: number | null;
      completedAt: Date;
    }> = [];

    for (const snapshot of snapshots) {
      const fitResult = (snapshot.fitResult || {}) as Record<string, unknown>;
      const fitScore = Number(fitResult.fit_score ?? 0);
      const envScore = Number(((fitResult.environmental_summary as Record<string, unknown> | undefined)?.suitability_score) ?? NaN);
      const infraScore = Number(((fitResult.infrastructure_summary as Record<string, unknown> | undefined)?.readiness_score) ?? NaN);
      const utilization = Number(fitResult.utilization_ratio ?? NaN);
      const report = reportBySnapshotId.get(snapshot._id.toString()) as
        | { report?: Record<string, unknown> | null }
        | undefined;
      const payload = (report?.report || {}) as Record<string, unknown>;
      const timeEstimate = (payload.timeEstimate || {}) as Record<string, unknown>;
      const costEstimate = (payload.costEstimate || {}) as Record<string, unknown>;

      if (Number.isFinite(fitScore)) fitScores.push(fitScore);
      if (Number.isFinite(envScore)) envScores.push(envScore);
      if (Number.isFinite(infraScore)) infraScores.push(infraScore);
      if (Number.isFinite(utilization)) utilizationRatios.push(utilization);

      if ((fitResult.fit_status === "valid" || fitScore >= 80) && !fitResult.has_water_collision && !fitResult.has_building_collision) {
        successfulAnalyses.push({
          id: snapshot._id.toString(),
          sessionTitle: sessionTitleMap.get(snapshot.sessionId.toString()) || "Untitled session",
          fitScore,
          environmentalScore: Number.isFinite(envScore) ? envScore : null,
          infrastructureScore: Number.isFinite(infraScore) ? infraScore : null,
          estimatedDurationDays: Number(timeEstimate.estimatedDurationDays ?? NaN) || null,
          totalBudget: Number(costEstimate.totalBudget ?? NaN) || null,
          completedAt: snapshot.completedAt,
        });
      }
    }

    successfulAnalyses.sort((left, right) => {
      const leftComposite = left.fitScore + (left.environmentalScore || 0) * 0.5 + (left.infrastructureScore || 0) * 0.5;
      const rightComposite = right.fitScore + (right.environmentalScore || 0) * 0.5 + (right.infrastructureScore || 0) * 0.5;
      return rightComposite - leftComposite;
    });

    const validSnapshots = snapshots.filter((snapshot) => {
      const fitResult = (snapshot.fitResult || {}) as Record<string, unknown>;
      return fitResult.fit_status === "valid";
    });

    const recommendationSignals: string[] = [];
    const avgFit = avg(fitScores);
    const avgEnv = avg(envScores);
    const avgInfra = avg(infraScores);
    const avgUtilization = avg(utilizationRatios);

    if ((avgEnv ?? 0) < 60) recommendationSignals.push("Prioritize stronger environmental suitability when ranking parcels.");
    if ((avgInfra ?? 0) < 60) recommendationSignals.push("Utility and transit readiness are recurring bottlenecks in past analyses.");
    if ((avgUtilization ?? 0) < 45) recommendationSignals.push("Historical selections are underutilizing land; favor better footprint-to-land ratios.");
    if ((avgFit ?? 0) < 85) recommendationSignals.push("Geometric fit is leaving margin on the table; optimize placement before locking a site.");

    return NextResponse.json({
      history: {
        totalAnalyses: snapshots.length,
        totalReports: reports.length,
        validFitRate: snapshots.length ? Number(((validSnapshots.length / snapshots.length) * 100).toFixed(1)) : 0,
        averageFitScore: avgFit,
        averageEnvironmentalScore: avgEnv,
        averageInfrastructureScore: avgInfra,
        averageUtilizationRatio: avgUtilization,
        recommendedSignals: recommendationSignals,
        topSuccessfulAnalyses: successfulAnalyses.slice(0, 5),
      },
    });
  } catch (error) {
    console.error("[API/contractor/gis/history][GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
