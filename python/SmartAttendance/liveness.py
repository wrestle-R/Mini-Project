import cv2
import numpy as np
from collections import deque

# Global flag
MP_AVAILABLE = False

try:
    import mediapipe as mp
    try:
        # Explicitly try importing solutions if it's missing from mp
        if not hasattr(mp, 'solutions'):
            import mediapipe.python.solutions as solutions
            mp.solutions = solutions

    except ImportError as e:
        print(f"Warning: Failed to import mediapipe.python.solutions: {e}")

    if hasattr(mp, 'solutions'):
        mp_face_mesh = mp.solutions.face_mesh
        face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True, # Need this for iris landmarks if we want to be fancy, but simple EAR is fine
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        MP_AVAILABLE = True
    else:
        print("Warning: mediapipe installed but 'solutions' not found. Liveness detection disabled.")
except ImportError:
    print("Warning: mediapipe not found. Liveness detection disabled.")
except Exception as e:
    print(f"Warning: Error initializing mediapipe: {e}. Liveness detection disabled.")

# Eye landmarks indices (MediaPipe 468 landmarks)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# Thresholds
EAR_THRESHOLD = 0.25 
CONSECUTIVE_FRAMES = 1

# State Management
liveness_states = {}

def calculate_ear(landmarks, eye_indices, img_w, img_h):
    coords = []
    for idx in eye_indices:
        lm = landmarks[idx]
        coords.append((lm.x * img_w, lm.y * img_h))
        
    dv1 = np.linalg.norm(np.array(coords[1]) - np.array(coords[5]))
    dv2 = np.linalg.norm(np.array(coords[2]) - np.array(coords[4]))
    dh = np.linalg.norm(np.array(coords[0]) - np.array(coords[3]))
    
    ear = (dv1 + dv2) / (2.0 * dh)
    return ear

def check_liveness_frame(frame, source_id="default"):
    """
    Process a single frame for liveness detection.
    """
    global liveness_states
    
    if source_id not in liveness_states:
        liveness_states[source_id] = {"counter": 0, "total_blinks": 0, "status": "Waiting for blink"}
        
    state = liveness_states[source_id]
    
    # If MediaPipe is not available, we cannot check blinking.
    # Return True (Alive) by default or False? 
    # Let's return False with a status message "Liveness Disabled" to be safe/clear.
    if not MP_AVAILABLE:
        return True, {
            "ear": 0.0,
            "blinks": 0,
            "status": "Liveness Check Disabled (MediaPipe Error)"
        }
    
    img_h, img_w, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    results = face_mesh.process(rgb_frame)
    
    ear_avg = 0.0
    
    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            landmarks = face_landmarks.landmark
            
            left_ear = calculate_ear(landmarks, LEFT_EYE, img_w, img_h)
            right_ear = calculate_ear(landmarks, RIGHT_EYE, img_w, img_h)
            
            ear_avg = (left_ear + right_ear) / 2.0
            
            if ear_avg < EAR_THRESHOLD:
                state["counter"] += 1
                state["status"] = "Eyes Closed"
            else:
                if state["counter"] >= CONSECUTIVE_FRAMES:
                    state["total_blinks"] += 1
                    state["status"] = "Blink Detected"
                else:
                    state["status"] = "Eyes Open"
                state["counter"] = 0
                
    is_alive = state["total_blinks"] > 0
    
    return is_alive, {
        "ear": float(ear_avg),
        "blinks": state["total_blinks"],
        "status": state["status"]
    }

def reset_liveness(source_id="default"):
    if source_id in liveness_states:
        liveness_states[source_id] = {"counter": 0, "total_blinks": 0, "status": "Reset"}
