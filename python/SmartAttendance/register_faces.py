import os
import glob
import json
import faiss
import numpy as np
from PIL import Image
from face_utils import (
    get_face_detector,
    get_face_encoder,
    extract_face_tensor,
    get_embedding,
)


def register_new_face(
    image_path,
    employee_id,
    index_file="face_index.faiss",
    mapping_file="id_mapping.json",
    allow_update=False,
):
    """
    Registers a single new face from an image path.
    Designed to be called by the API.
    """
    print(f"Attempting to register new face: {employee_id} from {image_path}")

    # 1. Load existing mapping to find next index
    id_mapping = {}
    next_idx = 0
    existing_idx = None
    if os.path.exists(mapping_file):
        try:
            with open(mapping_file, "r") as f:
                id_mapping = json.load(f)
                if id_mapping:
                    # Check if ID already exists
                    if employee_id in id_mapping.values():
                        for k, v in id_mapping.items():
                            if v == employee_id:
                                existing_idx = int(k)
                                break
                        if not allow_update:
                            print(f"ID {employee_id} already exists.")
                            return False, "ID already exists"

                    indices = [int(k) for k in id_mapping.keys()]
                    next_idx = max(indices) + 1 if indices else 0
        except Exception as e:
            print(f"Error loading mapping: {e}")
            return False, f"Error loading mapping: {str(e)}"

    # 2. Process Image
    detector = get_face_detector()
    encoder = get_face_encoder()

    try:
        img = Image.open(image_path).convert("RGB")
        face_tensor = extract_face_tensor(img, detector)

        if face_tensor is None:
            return False, "No face detected in image"

        emb = get_embedding(face_tensor, encoder)
        if emb is None:
            return False, "Failed to generate embedding"

    except Exception as e:
        return False, f"Error processing image: {str(e)}"

    # 3. Update FAISS Index
    d = 512
    new_embedding = np.array([emb]).astype("float32")

    try:
        if os.path.exists(index_file):
            index = faiss.read_index(index_file)
        else:
            index = faiss.IndexFlatIP(d)

        if existing_idx is not None and allow_update and index.ntotal > existing_idx:
            vectors = index.reconstruct_n(0, index.ntotal)
            vectors[existing_idx] = new_embedding[0]
            rebuilt = faiss.IndexFlatIP(d)
            rebuilt.add(vectors.astype("float32"))
            faiss.write_index(rebuilt, index_file)
        else:
            index.add(new_embedding)
            faiss.write_index(index, index_file)

    except Exception as e:
        return False, f"Error updating FAISS index: {str(e)}"

    # 4. Update Mapping
    if existing_idx is None:
        id_mapping[str(next_idx)] = employee_id
    with open(mapping_file, "w") as f:
        json.dump(id_mapping, f, indent=4)

    if existing_idx is not None and allow_update:
        return True, "Updated"

    return True, "Success"


def register_faces(
    employees_dir="employees",
    index_file="face_index.faiss",
    mapping_file="id_mapping.json",
):
    """
    Reads images from employees_dir, generates embeddings, and saves to FAISS index.
    Supports incremental updates: only processes new images.
    """
    if not os.path.exists(employees_dir):
        print(
            f"Error: Directory '{employees_dir}' not found. Please create it and add images."
        )
        return

    # Load existing mapping if available to check for existing employees
    id_mapping = {}
    next_idx = 0
    if os.path.exists(mapping_file):
        try:
            with open(mapping_file, "r") as f:
                loaded_mapping = json.load(f)
                # Convert keys to int to find max, but store as string in ID mapping
                if loaded_mapping:
                    # The mapping is "faiss_id": "employee_id"
                    # We need to know which employee_id is already there
                    existing_employee_ids = set(loaded_mapping.values())

                    # Also determine next available FAISS index
                    indices = [int(k) for k in loaded_mapping.keys()]
                    next_idx = max(indices) + 1 if indices else 0

                    id_mapping = loaded_mapping
                    print(f"Loaded existing mapping with {len(id_mapping)} entries.")
                else:
                    existing_employee_ids = set()
        except Exception as e:
            print(f"Error loading mapping file: {e}. Starting fresh.")
            existing_employee_ids = set()
    else:
        existing_employee_ids = set()

    # Initialize models
    print("Loading models...")
    detector = get_face_detector()
    encoder = get_face_encoder()

    embeddings_list = []
    new_entries_count = 0

    # Supported extensions
    image_files = glob.glob(os.path.join(employees_dir, "*.*"))
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp"}

    print(f"Found {len(image_files)} files in {employees_dir}.")

    for file_path in image_files:
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in valid_extensions:
            continue

        filename = os.path.basename(file_path)
        employee_id = os.path.splitext(filename)[0]  # ID is filename without extension

        if employee_id in existing_employee_ids:
            # print(f"Skipping {filename} (already registered).") # Optional: reduce verbosity
            continue

        print(f"Processing new image: {filename} (ID: {employee_id})...")

        try:
            img = Image.open(file_path).convert("RGB")
            face_tensor = extract_face_tensor(img, detector)

            if face_tensor is not None:
                emb = get_embedding(face_tensor, encoder)
                if emb is not None:
                    embeddings_list.append(emb)
                    id_mapping[str(next_idx)] = employee_id
                    existing_employee_ids.add(
                        employee_id
                    )  # Prevent duplicates if multiple images have same ID (overwrite?)
                    # If multiple images for same ID, this script assumes 1 image = 1 ID.
                    # If user has 101_1.jpg, 101_2.jpg, logic needs adjustment.
                    # Assuming unique filenames -> unique IDs or same ID multiple templates.
                    # Current logic: ID = filename. So 101_1 != 101.
                    # User instruction: "Image naming format: <employee_id>.jpg" -> implies 1 image per ID.

                    next_idx += 1
                    new_entries_count += 1
                    print(f"  -> Registered successfully.")
                else:
                    print(f"  -> Failed to generate embedding.")
            else:
                print(f"  -> No face detected.")

        except Exception as e:
            print(f"  -> Error processing file: {e}")

    if not embeddings_list:
        print("No new faces to register.")
        return

    # FAISS Index Handling
    d = 512
    new_embeddings_matrix = np.array(embeddings_list).astype("float32")

    if os.path.exists(index_file):
        try:
            print(f"Loading existing FAISS index from {index_file}...")
            index = faiss.read_index(index_file)
        except Exception as e:
            print(f"Error loading index: {e}. Creating new one.")
            index = faiss.IndexFlatIP(d)
    else:
        print("Creating new FAISS index...")
        index = faiss.IndexFlatIP(d)

    # Add new vectors
    index.add(new_embeddings_matrix)

    # Save Index
    faiss.write_index(index, index_file)
    print(f"Saved updated FAISS index to {index_file} with {index.ntotal} vectors.")

    # Save Mapping
    with open(mapping_file, "w") as f:
        json.dump(id_mapping, f, indent=4)
    print(f"Saved updated ID mapping to {mapping_file}.")


if __name__ == "__main__":
    # Ensure we are in the correct directory or handle paths
    # Assuming script is run from inside SmartAttendance or root

    # If running from inside the folder
    if os.path.exists("employees"):
        register_faces()
    # If running from parent
    elif os.path.exists("SmartAttendance/employees"):
        register_faces(
            "SmartAttendance/employees",
            "SmartAttendance/face_index.faiss",
            "SmartAttendance/id_mapping.json",
        )
    else:
        # Create default
        os.makedirs("employees", exist_ok=True)
        print("Created 'employees' folder. Please add images and run again.")
