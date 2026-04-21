import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/lib/models/Project";
import { verifyCustomToken } from "@/lib/auth";
import { normalizeProjectLocation } from "@/lib/project-location";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, location, startDate, endDate, budget } =
      await req.json();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const normalizedLocation = normalizeProjectLocation(location);

    const project = await Project.create({
      companyId: payload.id,
      title: title.trim(),
      description: description?.trim() || "",
      location: normalizedLocation,
      startDate: startDate || null,
      endDate: endDate || null,
      budget: budget || 0,
    });

    return NextResponse.json({
      id: project._id.toString(),
      companyId: project.companyId.toString(),
      title: project.title,
      description: project.description,
      status: project.status,
      location: normalizeProjectLocation(project.location),
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      isOpen: project.isOpen,
    });
  } catch (error) {
    console.error("[API/projects] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
    if (!payload || payload.role !== "company") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const projects = await Project.find({ companyId: payload.id }).sort({
      createdAt: -1,
    });

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p._id.toString(),
        companyId: p.companyId.toString(),
        title: p.title,
        description: p.description,
        status: p.status,
        location: normalizeProjectLocation(p.location),
        startDate: p.startDate,
        endDate: p.endDate,
        budget: p.budget,
        isOpen: p.isOpen,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API/projects] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
