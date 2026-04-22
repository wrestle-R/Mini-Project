from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import cv2
import numpy as np
import uvicorn
from contextlib import asynccontextmanager
import io
import os
import shutil
import uuid
import json
from typing import Optional, List, Dict, Any

# IFC Processing Pipeline
from backend.services.model_builder import build_internal_model
from backend.services.geometry_generator import generate_glb_from_model

# Chatbot and Model Editing
from backend.ai.chatbot import parse_instruction, ActionValidationError
from backend.services.model_editor import execute_action, validate_model, ModelEditorError

import sys

# GIS / Spatial Intelligence router
from backend.gis.router import router as gis_router

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SMART_ATTENDANCE_DIR = os.path.join(BASE_DIR, "SmartAttendance")

# Add SmartAttendance to sys.path to allow internal imports to work from any cwd.
if SMART_ATTENDANCE_DIR not in sys.path:
    sys.path.append(SMART_ATTENDANCE_DIR)

# Adjusted imports for parent directory usage
from SmartAttendance.recognition import load_resources, process_frame_core, SIMILARITY_THRESHOLD
from SmartAttendance.liveness import check_liveness_frame, reset_liveness
from SmartAttendance.register_faces import register_new_face
from SmartAttendance.face_utils import extract_face_tensor, get_embedding
from SmartAttendance.mock_db import get_employee_details

import datetime

ATTENDANCE_FILE = os.path.join("data", "attendance", "attendance_log.json")
FACE_FALLBACK_THRESHOLD = max(0.5, SIMILARITY_THRESHOLD - 0.05)

def _load_attendance_log() -> List[Dict[str, Any]]:
    os.makedirs(os.path.dirname(ATTENDANCE_FILE), exist_ok=True)

    if not os.path.exists(ATTENDANCE_FILE):
        with open(ATTENDANCE_FILE, "w") as f:
            json.dump([], f)
        return []

    try:
        with open(ATTENDANCE_FILE, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except Exception as e:
        print(f"Warning: Failed to load attendance log: {e}. Starting with empty log.")

    return []

def _save_attendance_log() -> None:
    os.makedirs(os.path.dirname(ATTENDANCE_FILE), exist_ok=True)
    with open(ATTENDANCE_FILE, "w") as f:
        json.dump(attendance_log, f, indent=2)

attendance_log = _load_attendance_log()

# Global resources
resources = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load models on startup
    global resources
    print("Initializing API resources...")
    resources = load_resources()
    yield
    # Clean up if needed
    print("Shutting down API resources...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register GIS / Spatial Intelligence router
app.include_router(gis_router)

# Ensure directories exist
os.makedirs("models", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("data/models", exist_ok=True)
os.makedirs("data/glb", exist_ok=True)

# Serve generated GLB and data files
app.mount("/models", StaticFiles(directory="models"), name="models")
app.mount("/data", StaticFiles(directory="data"), name="data")

def process_frame_from_bytes(contents: bytes, source_id: str = "esp32", check_ppe: bool = True):
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data.")

    person_conf = 0.3 if min(frame.shape[0], frame.shape[1]) <= 480 else 0.5
    is_alive, liveness_details = check_liveness_frame(frame, source_id)
    matches, _ = process_frame_core(frame, resources, check_ppe=check_ppe, person_conf=person_conf)

    person_pipeline_count = len(matches)
    used_face_fallback = False
    fallback_attempts = 0
    fallback_face_detected = False
    fallback_best_score = 0.0

    # ESP32 frames are often close-up faces where person detector may miss.
    # Fallback to full-frame face recognition to avoid false "no_person_detected" failures.
    if person_pipeline_count == 0:
        _, _, detector, encoder, index, id_mapping = resources
        if index is not None and id_mapping:
            candidate_frames = [frame]
            if min(frame.shape[0], frame.shape[1]) <= 480:
                candidate_frames.append(cv2.resize(frame, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC))

            for candidate in candidate_frames:
                fallback_attempts += 1
                candidate_rgb = cv2.cvtColor(candidate, cv2.COLOR_BGR2RGB)
                face_tensor = extract_face_tensor(candidate_rgb, detector)

                if face_tensor is None:
                    continue

                fallback_face_detected = True
                emb = get_embedding(face_tensor, encoder)
                if emb is None:
                    continue

                query_vector = np.array([emb]).astype("float32")
                distances, indices = index.search(query_vector, k=1)
                score = float(distances[0][0])
                fallback_best_score = max(fallback_best_score, score)

                matched_idx = int(indices[0][0])
                employee_id = id_mapping.get(str(matched_idx)) if score > FACE_FALLBACK_THRESHOLD else None

                if employee_id:
                    details = get_employee_details(employee_id)
                    matches = [{
                        "id": employee_id,
                        "name": details.get("name", f"Employee {employee_id}"),
                        "score": score,
                        "bbox": [0, 0, int(frame.shape[1]), int(frame.shape[0])],
                        "detection_mode": "face_fallback",
                    }]
                    used_face_fallback = True
                    break

    return {
        "status": "success",
        "liveness": {
            "is_alive": is_alive,
            "details": liveness_details
        },
        "matches": matches,
        "diagnostics": {
            "frame_size": [int(frame.shape[1]), int(frame.shape[0])],
            "person_conf": person_conf,
            "person_pipeline_count": person_pipeline_count,
            "used_face_fallback": used_face_fallback,
            "fallback_attempts": fallback_attempts,
            "fallback_face_detected": fallback_face_detected,
            "fallback_threshold": FACE_FALLBACK_THRESHOLD,
            "fallback_best_score": fallback_best_score,
        },
    }


@app.post("/iot/frame")
async def iot_frame(request: Request, source_id: str = "esp32_cam_1"):
    if resources is None:
        raise HTTPException(status_code=503, detail="Server resources not initialized.")

    contents = await request.body()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image body.")
    
    result = process_frame_from_bytes(contents, source_id=source_id, check_ppe=False)

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_records = []

    if result["matches"]:
        for person in result["matches"]:
            recognized = person.get("id") is not None
            live_ok = result["liveness"]["is_alive"]
            is_success = recognized and live_ok

            if is_success:
                reason = "recognized_and_live"
            elif recognized:
                reason = "liveness_failed"
            else:
                reason = "face_not_recognized"

            record = {
                "id": person.get("id"),
                "name": person.get("name", "Unknown"),
                "score": float(person.get("score", 0.0)),
                "status": "success" if is_success else "failure",
                "reason": reason,
                "time": timestamp,
                "source": source_id,
                "diagnostics": result.get("diagnostics", {}),
            }
            attendance_log.append(record)
            new_records.append(record)
    else:
        record = {
            "id": None,
            "name": "Unknown",
            "score": 0.0,
            "status": "failure",
            "reason": "no_person_or_face_detected",
            "time": timestamp,
            "source": source_id,
            "diagnostics": result.get("diagnostics", {}),
        }
        attendance_log.append(record)
        new_records.append(record)

    _save_attendance_log()

    result["attendance"] = {
        "saved": True,
        "records_added": len(new_records),
        "records": new_records,
    }

    return JSONResponse(content=result)

@app.get("/attendance")
def get_attendance(limit: int = 100):
    safe_limit = max(1, min(limit, 1000))
    records = attendance_log[-safe_limit:]
    return {"count": len(records), "records": records}

@app.get("/attendance/summary")
def get_attendance_summary():
    success_count = sum(1 for record in attendance_log if record.get("status") == "success")
    failure_count = sum(1 for record in attendance_log if record.get("status") == "failure")

    return {
        "total": len(attendance_log),
        "success": success_count,
        "failure": failure_count,
    }

def _is_conversational_message(message: str) -> bool:
    text = message.strip().lower()
    if not text:
        return True

    conversational_starts = (
        "hello",
        "hi",
        "hey",
        "hellp",
        "help",
        "thanks",
        "thank you",
        "good morning",
        "good afternoon",
        "good evening",
        "who are you",
        "what can you do",
    )
    edit_keywords = (
        "wall",
        "column",
        "slab",
        "door",
        "window",
        "beam",
        "roof",
        "space",
        "stair",
        "member",
        "add",
        "remove",
        "update",
        "change",
        "duplicate",
        "move",
        "rotate",
        "scale",
        "color",
        "colour",
    )

    if any(text.startswith(prefix) for prefix in conversational_starts):
        return True

    if len(text.split()) <= 3 and not any(keyword in text for keyword in edit_keywords):
        return True

    return False

@app.get("/")
def read_root():
    return {"message": "Smart Attendance API is running."}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/recognize_frame")
async def recognize_frame(
    file: UploadFile = File(...),
    source_id: str = Form("default"), # Used to track blinking state for a specific camera
    check_ppe: str = Form("true") # Receive as string from FormData, convert to bool
):
    """
    Accepts an image file (jpeg/png) and returns recognized faces + liveness status.
    Also checks for Personal Protective Equipment (Hard Hat, Vest) if check_ppe is True.
    Designed for ESP32 or other IOT devices streaming frames.
    """
    if resources is None:
        raise HTTPException(status_code=503, detail="Server resources not initialized.")

    try:
        # Convert check_ppe string to boolean
        should_check_ppe = check_ppe.lower() == 'true'

        # Read image bytes
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        
        # Decode to OpenCV format
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
             raise HTTPException(status_code=400, detail="Invalid image file.")
        
        # 1. Check Liveness (Blinking)
        is_alive, liveness_details = check_liveness_frame(frame, source_id)
        
        # 2. Recognize Faces
        matches, _ = process_frame_core(frame, resources, check_ppe=should_check_ppe)
        
        return JSONResponse(content={
            "status": "success",
            "liveness": {
                "is_alive": is_alive,
                "details": liveness_details
            },
            "matches": matches
        })
        
    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/register_face")
async def register_face_endpoint(
    file: UploadFile = File(...),
    employee_id: str = Form(...)
):
    """
    Registers a new employee face.
    Saves image to SmartAttendance/employees and updates FAISS index.
    """
    try:
        # Define path inside SmartAttendance directory
        base_dir = "SmartAttendance"
        emp_dir = os.path.join(base_dir, "employees")
        os.makedirs(emp_dir, exist_ok=True)
        
        file_ext = os.path.splitext(file.filename)[1]
        if not file_ext: file_ext = ".jpg"
        
        save_path = os.path.join(emp_dir, f"{employee_id}{file_ext}")
        
        # Save file to disk
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Call registration logic
        # Paths for index and mapping should also be relative to SmartAttendance
        index_file = os.path.join(base_dir, "face_index.faiss")
        mapping_file = os.path.join(base_dir, "id_mapping.json")

        success, message = register_new_face(save_path, employee_id, index_file=index_file, mapping_file=mapping_file)
        
        if success:
            # Reload resources to recognize the new user immediately
            global resources
            resources = load_resources() # load_resources handles paths internally if CWD is correct or needs adjustment? 
            # recognition.py load_resources logic:
            # it checks if index_file exists, or checks SmartAttendance/index_file.
            # Since we are running from root now, load_resources() default args might look for 'face_index.faiss' in root.
            # better to be explicit or let load_resources handle it. 
            # Actually, let's call load_resources with explicit paths to be safe, OR rely on its internal check.
            # The internal check in `recognition.py` (line 14) handles `SmartAttendance/` prefix.
            
            return JSONResponse(content={
                "status": "success", 
                "message": f"User {employee_id} registered successfully."
            })
        else:
            # Cleanup if failed
            if os.path.exists(save_path):
                os.remove(save_path)
            return JSONResponse(status_code=400, content={
                "status": "error", 
                "message": message
            })
            
    except Exception as e:
        print(f"Error registering face: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset_liveness")
async def reset_liveness_endpoint(source_id: str = Form(...)):
    reset_liveness(source_id)
    return {"status": "success", "message": f"Liveness state reset for {source_id}"}


@app.post("/api/ifc/upload")
async def upload_ifc(file: UploadFile = File(...)):
    """
    Accept an uploaded IFC file, convert to internal JSON model,
    then generate GLB. Returns project_id for subsequent chat requests.
    
    Pipeline: IFC → JSON (source of truth) → GLB (regenerable)
    """
    if not file.filename or not file.filename.lower().endswith(".ifc"):
        raise HTTPException(status_code=400, detail="Only .ifc files are accepted.")

    project_id = f"project_{uuid.uuid4().hex[:8]}"
    upload_path = os.path.join("uploads", f"{project_id}_{file.filename}")
    
    try:
        # Save uploaded file
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Step 1: Parse IFC → internal JSON model
        model = build_internal_model(upload_path, project_id)

        if len(model.get("elements", [])) == 0:
            raise ValueError(
                "No supported/renderable IFC elements were extracted. "
                "Check IFC content or extend element type mapping in model_builder."
            )
        
        # Save JSON (source of truth)
        json_path = os.path.join("data/models", f"{project_id}.json")
        with open(json_path, 'w') as f:
            json.dump(model, f, indent=2)
        
        # Step 2: Generate GLB from JSON
        glb_path = os.path.join("data/glb", f"{project_id}.glb")
        generate_glb_from_model(json_path, glb_path)
        
        # Extract metadata from model for frontend
        metadata = {}
        for elem in model.get("elements", []):
            metadata[elem["id"]] = {
                "globalId": elem["id"],
                "type": elem.get("type"),
                "name": elem.get("name"),
                "description": "",
                "objectType": elem.get("type"),
                "properties": elem.get("properties", {})
            }
        
        # Save metadata
        metadata_path = os.path.join("data/models", f"{project_id}_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return JSONResponse(content={
            "status": "success",
            "project_id": project_id,
            "model_url": f"/data/glb/{project_id}.glb",
            "json_url": f"/data/models/{project_id}.json",
            "metadata_url": f"/data/models/{project_id}_metadata.json",
        })
    except ValueError as e:
        print(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Error processing IFC file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temporary upload
        if os.path.exists(upload_path):
            os.remove(upload_path)


@app.post("/api/chat/{project_id}")
async def chat_with_model(
    project_id: str, 
    message: str = Form(...),
    selected_contexts: Optional[str] = Form(None)
):
    """
    Process natural language instruction and update model.
    
    Flow:
    1. Parse instruction → JSON action (via LLM)
    2. Validate action
    3. Load JSON model
    4. Execute action (modify model)
    5. Validate modified model
    6. Save JSON
    7. Regenerate GLB
    8. Return new model_url
    """
    try:
        if _is_conversational_message(message):
            return JSONResponse(content={
                "status": "success",
                "reply": "Hello. I can help edit the IFC model. Try commands like 'make all walls taller' or 'change the slab color to gray'."
            })

        # Step 1: Parse contexts if provided
        contexts = None
        if selected_contexts:
            try:
                contexts = json.loads(selected_contexts)
            except:
                pass
                
        # Parse instruction with LLM
        response_data = parse_instruction(message, contexts)
        actions_to_execute = response_data.get("actions", [])
        
        # Step 2: Load JSON model
        json_path = os.path.join("data/models", f"{project_id}.json")
        if not os.path.exists(json_path):
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        with open(json_path, 'r') as f:
            model = json.load(f)
        
        # Step 3: Execute actions on model sequentially
        modified_model = model
        merged_msgs = []
        for action in actions_to_execute:
            modified_model, action_msg = execute_action(modified_model, action)
            merged_msgs.append(action_msg)
        
        # Step 4: Validate modified model
        validate_model(modified_model)
        
        # Step 5: Save modified JSON
        with open(json_path, 'w') as f:
            json.dump(modified_model, f, indent=2)
        
        # Step 6: Regenerate GLB
        glb_path = os.path.join("data/glb", f"{project_id}.glb")
        generate_glb_from_model(json_path, glb_path)
        
        # Step 7: Update metadata
        metadata = {}
        for elem in modified_model.get("elements", []):
            metadata[elem["id"]] = {
                "globalId": elem["id"],
                "type": elem.get("type"),
                "name": elem.get("name"),
                "description": "",
                "objectType": elem.get("type"),
                "properties": elem.get("properties", {})
            }
        
        metadata_path = os.path.join("data/models", f"{project_id}_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return JSONResponse(content={
            "status": "success",
            "actions": actions_to_execute,
            "plan": response_data.get("plan", []),
            "explanation": response_data.get("explanation", "Changes applied successfully."),
            "model_url": f"/data/glb/{project_id}.glb",
            "message": "\n".join(merged_msgs)
        })
    
    except ActionValidationError as e:
        return JSONResponse(status_code=422, content={
            "status": "error",
            "message": f"Invalid action: {str(e)}"
        })
    
    except ModelEditorError as e:
        return JSONResponse(status_code=400, content={
            "status": "error",
            "message": f"Model edit failed: {str(e)}"
        })
    
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": str(e)
        })


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
