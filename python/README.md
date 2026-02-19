# Smart Attendance System

This project implements a modular face recognition system using:
- **OpenCV** for video capture
- **YOLOv8** for person detection
- **FaceNet (InceptionResnetV1)** for face embeddings
- **FAISS** for fast similarity search

## Requirements

Python 3.8+ recommended.

### Install Dependencies

Run the following commands to install the necessary libraries:

```bash
pip install opencv-python
pip install torch torchvision
pip install ultralytics
pip install facenet-pytorch
pip install faiss-cpu
pip install numpy
```

## Setup

1.  **Project Structure**:
    Ensure your directory looks like this:
    ```
    SmartAttendance/
    ├── recognition.py
    ├── register_faces.py
    ├── face_utils.py
    ├── mock_db.py
    ├── employees/         <-- Put employee images here
    └── README.md
    ```

2.  **Register Employees**:
    - Add images of employees to the `employees` folder.
    - Name the files with the employee ID (e.g., `101.jpg`, `102.png`).
    - Run the registration script:
      ```bash
      python register_faces.py
      ```
    - This will generate `face_index.faiss` and `id_mapping.json`.

## Usage

### 1. Register Faces (Incremental)
Add images to the `employees` folder (e.g., `101.jpg`, `102.png`).
Run the registration script:
```bash
python register_faces.py
```
- The script is **incremental**. It will only process new images that haven't been registered yet.
- It generates/updates `face_index.faiss` and `id_mapping.json`.

### 2. Live Recognition (Webcam)
```bash
python recognition.py
```
- Opens a webcam window and highlights recognized faces.

### 3. API Server (For ESP32 / IoT)
Start the FastAPI server from the project root:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Endpoint 1**: `POST /recognize_frame`
- **Input**: 
    - `file`: Image file (jpeg/png).
    - `source_id`: (Optional) String ID for the camera (e.g., "cam1") to track blinking state.
- **Output JSON**:
  ```json
  {
      "status": "success",
      "liveness": {
          "is_alive": true,
          "details": { "status": "Blink Detected", "blinks": 2 }
      },
      "matches": [
          {
              "id": "101",
              "name": "Employee Name", 
              "score": 0.88,
              "bbox": [...]
          }
      ]
  }
  ```
  *Note: `is_alive` will be false until a blink is detected in the stream of frames for that `source_id`.*

**Endpoint 2**: `POST /register_face`
- **Input**:
    - `file`: Image of the new user.
    - `employee_id`: Unique ID for the user.
- **Output**: Registers the user and updates the database immediately.

**Endpoint 3**: `POST /reset_liveness`
- **Input**: `source_id`
- Resets the blink counter for that camera.


**Testing the API**:
```bash
python test_api.py path/to/image.jpg
```

