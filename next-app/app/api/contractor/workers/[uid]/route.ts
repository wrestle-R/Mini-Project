import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyCustomToken } from "@/lib/auth";
import Worker from "@/lib/models/Worker";
import WorkerProfile from "@/lib/models/WorkerProfile";
import ProjectApplication from "@/lib/models/ProjectApplication";
// Ensure Project schema is registered for population
import "@/lib/models/Project";

/**
 * GET /api/contractor/workers/[uid]
 * Returns a worker's public profile + job history (accepted applications).
 * Only accessible by authenticated contractors.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "contractor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uid } = await params;

    await dbConnect();

    const [worker, profile, jobHistory] = await Promise.all([
      Worker.findOne({ firebaseUid: uid }).select(
        "firebaseUid email firstName lastName phone photoUrl createdAt"
      ),
      WorkerProfile.findOne({ firebaseUid: uid }),
      // Job history = all accepted applications (past + current)
      ProjectApplication.find({
        workerFirebaseUid: uid,
        status: "accepted",
      })
        .populate("projectId", "title status location startDate endDate")
        .sort({ appliedAt: -1 })
        .limit(20),
    ]);

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    return NextResponse.json({
      worker: {
        firebaseUid: worker.firebaseUid,
        email: worker.email,
        firstName: worker.firstName,
        lastName: worker.lastName,
        phone: worker.phone,
        photoUrl: worker.photoUrl,
        memberSince: worker.createdAt,
      },
      profile: profile
        ? {
            bio: profile.bio,
            profilePhotoUrl: profile.profilePhotoUrl,
            skills: profile.skills,
            tradeSpecialties: profile.tradeSpecialties,
            experienceYears: profile.experienceYears,
            hourlyRate: profile.hourlyRate,
            availability: profile.availability,
            location: profile.location,
            languages: profile.languages,
            preferredWorkTypes: profile.preferredWorkTypes,
            toolsOwned: profile.toolsOwned,
            hasVehicle: profile.hasVehicle,
            willingToRelocate: profile.willingToRelocate,
          }
        : null,
      jobHistory: jobHistory.map((app) => {
        const proj = app.projectId as unknown as {
          _id: { toString(): string };
          title: string;
          status: string;
          location: string;
          startDate: Date;
          endDate: Date;
        } | null;
        return {
          applicationId: app._id.toString(),
          project: proj
            ? {
                id: proj._id.toString(),
                title: proj.title,
                status: proj.status,
                location: proj.location,
                startDate: proj.startDate,
                endDate: proj.endDate,
              }
            : null,
          appliedAt: app.appliedAt,
        };
      }),
    });
  } catch (error) {
    console.error("[API/contractor/workers/[uid]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
