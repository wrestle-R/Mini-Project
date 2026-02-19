import cv2
import faiss
import json
import torch
import numpy as np
from ultralytics import YOLO
from PIL import Image
from face_utils import get_face_detector, get_face_encoder, extract_face_tensor, get_embedding
from mock_db import get_employee_details
from liveness import check_liveness_frame
import os

SIMILARITY_THRESHOLD = 0.6 

def load_resources(index_file="face_index.faiss", mapping_file="id_mapping.json"):
    """
    Loads FAISS index, ID mapping, and AI models.
    """
    print("Loading resources...")
    
    # Check if files exist in current or parent dir
    if not os.path.exists(index_file) and os.path.exists(f"SmartAttendance/{index_file}"):
         index_file = f"SmartAttendance/{index_file}"
         mapping_file = f"SmartAttendance/{mapping_file}"
            
    # Load Models
    yolo_model = YOLO("yolov8n.pt") # Detects 'person'
    detector = get_face_detector()
    encoder = get_face_encoder()
    
    # Load FAISS Index and Mapping
    try:
        if os.path.exists(index_file):
            index = faiss.read_index(index_file)
            with open(mapping_file, 'r') as f:
                id_mapping = json.load(f)
        else:
            print(f"Warning: {index_file} not found. Recognition will fail for specific faces.")
            index = None
            id_mapping = {}
            
    except Exception as e:
        print(f"Error loading index/mapping: {e}")
        index = None
        id_mapping = {}
        
    return yolo_model, detector, encoder, index, id_mapping

def process_frame_core(frame, resources):
    """
    Core logic to process a frame and return matches.
    
    Args:
        frame: OpenCV BGR image.
        resources: Tuple (yolo_model, detector, encoder, index, id_mapping)
        
    Returns:
        matches: List of dicts with detection info.
        annotated_frame: Frame with drawn boxes.
    """
    yolo_model, detector, encoder, index, id_mapping = resources
    matches = []
    
    if index is None or not id_mapping:
         return matches, frame

    # YOLO Detection
    results = yolo_model(frame, classes=[0], verbose=False) # class 0 is person
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            # YOLO Bounding Box
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            
            if conf < 0.5: continue
            
            # Crop person
            h, w, c = frame.shape
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            person_crop = frame[y1:y2, x1:x2]
            
            if person_crop.size == 0: continue
            
            # Convert BGR to RGB
            person_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
            person_pil = Image.fromarray(person_rgb)
            
            # Detect Face in Crop
            face_tensor = extract_face_tensor(person_pil, detector)
            
            label = "Unknown"
            color = (0, 0, 255) # Red for unknown
            info_text = ""
            match_data = {
                "id": None,
                "name": "Unknown",
                "score": 0.0,
                "bbox": [x1, y1, x2, y2]
            }

            if face_tensor is not None:
                # Generate Embedding
                emb = get_embedding(face_tensor, encoder)
                
                if emb is not None:
                    # Search in FAISS
                    query_vector = np.array([emb]).astype('float32')
                    D, I = index.search(query_vector, k=1) 
                    
                    score = float(D[0][0])
                    idx = I[0][0]
                    
                    if score > SIMILARITY_THRESHOLD:
                         employee_id = id_mapping.get(str(idx), "Unknown")
                         details = get_employee_details(employee_id)
                         name = details['name']
                         
                         label = f"{name} ({employee_id})"
                         color = (0, 255, 0)
                         info_text = f"Score: {score:.2f}"
                         
                         match_data["id"] = employee_id
                         match_data["name"] = name
                         match_data["score"] = score
                    else:
                         info_text = f"Score: {score:.2f}"
                         match_data["score"] = score

            matches.append(match_data)

            # Draw Box and Label
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
            if info_text:
                cv2.putText(frame, info_text, (x1, y2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    return matches, frame

def run_recognition():
    # Setup resources
    resources = load_resources()
    
    # Open Webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("Starting Recognition. Press 'q' to exit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Liveness Check
        is_alive, liveness_details = check_liveness_frame(frame, "webcam_local")
        
        matches, annotated_frame = process_frame_core(frame, resources)
        
        # Display Liveness Status
        status_color = (0, 255, 0) if is_alive else (0, 0, 255)
        status_text = f"Liveness: {'Alive' if is_alive else 'Checking...'} ({liveness_details['status']})"
        
        if "Disabled" in liveness_details['status']:
            status_color = (0, 255, 255) # Yellow
            status_text = "Liveness: Disabled (MediaPipe issues on Python 3.13)"
            
        cv2.putText(annotated_frame, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        
        cv2.imshow('Smart Attendance - Face Recognition', annotated_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run_recognition()
