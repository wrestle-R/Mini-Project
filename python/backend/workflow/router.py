from __future__ import annotations

import traceback

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .report_graph import build_report_payload


class WorkflowReportRequest(BaseModel):
    model: dict = Field(default_factory=dict)
    validationSnapshotId: str
    ifcSessionId: str
    ifcVersionNumber: int
    fitResult: dict = Field(default_factory=dict)


router = APIRouter(prefix="/api/workflow", tags=["Workflow"])


@router.post("/report/generate")
async def generate_report_endpoint(req: WorkflowReportRequest):
    try:
        print("[workflow/report] request received", {
            "ifcSessionId": req.ifcSessionId,
            "ifcVersionNumber": req.ifcVersionNumber,
            "elements": len(req.model.get("elements", [])) if isinstance(req.model, dict) else None,
            "groq_key_present": bool(__import__("os").getenv("GROQ_API_KEY")),
        }, flush=True)
        report = build_report_payload(req.model_dump())
        print("[workflow/report] report built", {
            "schemaVersion": report.get("schemaVersion"),
            "projectTimeline": len(report.get("projectTimeline", [])),
            "workforceByPhase": len(report.get("workforceByPhase", [])),
        }, flush=True)
        return JSONResponse(content={"report": report})
    except Exception as exc:
        print("[workflow/report] failed", repr(exc), flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")
