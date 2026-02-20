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
    # 1. Standard YOLO for Person Detection (Face ID)
    yolo_person_model = YOLO("yolov8n.pt") 
    
    # 2. Fine-tuned YOLO for PPE Detection
    yolo_ppe_model_path = "yolo_training/valid/weights/best.pt"
    if not os.path.exists(yolo_ppe_model_path) and os.path.exists(f"python/{yolo_ppe_model_path}"):
        yolo_ppe_model_path = f"python/{yolo_ppe_model_path}"
    
    # Load if exists, else None (PPE check will fail/skip)
    try:
        yolo_ppe_model = YOLO(yolo_ppe_model_path)
    except Exception as e:
        print(f"Warning: Could not load PPE model from {yolo_ppe_model_path}: {e}")
        yolo_ppe_model = None

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
        
    return yolo_person_model, yolo_ppe_model, detector, encoder, index, id_mapping

def process_frame_core(frame, resources, check_ppe=True):
    """
    Core logic to process a frame and return matches.
    
    Args:
        frame: OpenCV BGR image.
        resources: Tuple (yolo_model, detector, encoder, index, id_mapping)
        check_ppe: Boolean to enable/disable PPE checks.
        
    Returns:
        matches: List of dicts with detection info.
        annotated_frame: Frame with drawn boxes.
    """
    yolo_person_model, yolo_ppe_model, detector, encoder, index, id_mapping = resources
    matches = []
    
    if index is None or not id_mapping:
         return matches, frame

    # 1. Standard Person Detection (Class 0 in COCO)
    # increased confidence to avoid false positives
    results_person = yolo_person_model(frame, classes=[0], conf=0.5, verbose=False) 
    
    persons = []
    for result in results_person:
        boxes = result.boxes
        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            persons.append({'bbox': [x1, y1, x2, y2], 'conf': conf})

    # 2. PPE Detection (Conditional)
    hard_hats = []
    vests = []
    
    if check_ppe and yolo_ppe_model:
        # Detect Hard_hat (1) and Vest (5) from Fine-tuned model
        results_ppe = yolo_ppe_model(frame, classes=[1, 5], conf=0.4, verbose=False)
        for result in results_ppe:
            boxes = result.boxes
            for box in boxes:
                cls = int(box.cls[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                item = {'bbox': [x1, y1, x2, y2], 'conf': conf}
                
                if cls == 1: hard_hats.append(item)
                elif cls == 5: vests.append(item)

    # Helper function to check overlap/containment
    def check_overlap(person_box, item_box):
        px1, py1, px2, py2 = person_box
        ix1, iy1, ix2, iy2 = item_box
        
        # Check if item center is within person box or significant overlap
        ix_center = (ix1 + ix2) / 2
        iy_center = (iy1 + iy2) / 2
        
        if px1 < ix_center < px2 and py1 < iy_center < py2:
            return True
        return False

    for person in persons:
        px1, py1, px2, py2 = person['bbox']
        
        # Check PPE
        has_hard_hat = False
        has_vest = False
        is_compliant = True
        
        if check_ppe:
            for hat in hard_hats:
                if check_overlap(person['bbox'], hat['bbox']):
                    has_hard_hat = True
                    break
            
            for vest in vests:
                if check_overlap(person['bbox'], vest['bbox']):
                    has_vest = True
                    break

            is_compliant = has_hard_hat and has_vest
        
        # Crop person for Face ID (Standard YOLO Box)
        h, w, c = frame.shape
        cx1, cy1 = max(0, px1), max(0, py1)
        cx2, cy2 = min(w, px2), min(h, py2)
        
        person_crop = frame[cy1:cy2, cx1:cx2]
        
        match_data = {
            "id": None,
            "name": "Unknown",
            "score": 0.0,
            "bbox": [px1, py1, px2, py2],
        }
        
        if check_ppe:
            match_data["ppe"] = {
                "hard_hat": has_hard_hat,
                "vest": has_vest,
                "compliant": is_compliant
            }

        # Face Recognition Logic
        if person_crop.size > 0:
            # Convert BGR to RGB
            person_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
            person_pil = Image.fromarray(person_rgb)
            
            # Detect Face in Crop
            face_tensor = extract_face_tensor(person_pil, detector)
            
            label = "Unknown"
            color = (0, 0, 255) # Red for unknown/non-compliant
            
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
                         
                         match_data["id"] = employee_id
                         match_data["name"] = name
                         match_data["score"] = score
                         
                         if is_compliant:
                             label = f"{name} ({employee_id})"
                             color = (0, 255, 0) # Green for compliant known user
                         else:
                             label = f"{name} (MISSING PPE)"
                             color = (0, 0, 255) # Red for non-compliant
                    else:
                         match_data["score"] = score
            
        matches.append(match_data)

        # Draw Box and Label
        # If not compliant, color always red
        draw_color = (0, 255, 0) if is_compliant and match_data["id"] else (0, 0, 255)
        
        cv2.rectangle(frame, (px1, py1), (px2, py2), draw_color, 2)
        
        # Label Construction
        display_label = match_data["name"]
        if not is_compliant and check_ppe:
            missing = []
            if not has_hard_hat: missing.append("Hat")
            if not has_vest: missing.append("Vest")
            display_label += f" No: {','.join(missing)}"
            
        cv2.putText(frame, display_label, (px1, py1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, draw_color, 2)

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
