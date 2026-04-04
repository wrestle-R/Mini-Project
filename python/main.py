from fastapi import FastAPI, File, UploadFile, HTTPException, Form
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

# IFC Processing Pipeline
from backend.services.model_builder import build_internal_model
from backend.services.geometry_generator import generate_glb_from_model

# Chatbot and Model Editing
from backend.ai.chatbot import parse_instruction, ActionValidationError
from backend.services.model_editor import execute_action, validate_model, ModelEditorError

import sys

# Add SmartAttendance to sys.path to allow internal imports to work
sys.path.append(os.path.join(os.getcwd(), "SmartAttendance"))

# Adjusted imports for parent directory usage
from SmartAttendance.recognition import load_resources, process_frame_core
from SmartAttendance.liveness import check_liveness_frame, reset_liveness
from SmartAttendance.register_faces import register_new_face

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

# Ensure directories exist
os.makedirs("models", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("data/models", exist_ok=True)
os.makedirs("data/glb", exist_ok=True)

# Serve generated GLB and data files
app.mount("/models", StaticFiles(directory="models"), name="models")
app.mount("/data", StaticFiles(directory="data"), name="data")


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
async def chat_with_model(project_id: str, message: str = Form(...)):
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

        # Step 1: Parse instruction with LLM
        action = parse_instruction(message)
        
        # Step 2: Load JSON model
        json_path = os.path.join("data/models", f"{project_id}.json")
        if not os.path.exists(json_path):
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        
        with open(json_path, 'r') as f:
            model = json.load(f)
        
        # Step 3: Execute action on model
        modified_model = execute_action(model, action)
        
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
            "action": action,
            "model_url": f"/data/glb/{project_id}.glb",
            "message": f"Action '{action.get('action')}' executed successfully"
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
