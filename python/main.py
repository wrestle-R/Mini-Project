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

from backend.services.ifc_converter import convert_ifc_to_glb
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

# Ensure models/ and uploads/ directories exist
os.makedirs("models", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

# Serve generated GLB files
app.mount("/models", StaticFiles(directory="models"), name="models")

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
    Accept an uploaded IFC file, convert it to GLB, and return the URL to the model.
    """
    if not file.filename or not file.filename.lower().endswith(".ifc"):
        raise HTTPException(status_code=400, detail="Only .ifc files are accepted.")

    # Save uploaded file with a unique name to avoid collisions
    unique_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join("uploads", f"{unique_id}_{file.filename}")
    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        output_filename = f"building_{unique_id}.glb"
        output_path = os.path.join("models", output_filename)

        metadata_path = convert_ifc_to_glb(upload_path, output_path)
        metadata_filename = os.path.basename(metadata_path)

        return JSONResponse(content={
            "status": "success",
            "model_url": f"/models/{output_filename}",
            "metadata_url": f"/models/{metadata_filename}",
        })
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Error converting IFC file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up the temporary upload
        if os.path.exists(upload_path):
            os.remove(upload_path)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
