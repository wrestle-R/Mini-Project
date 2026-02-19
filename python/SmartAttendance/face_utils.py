import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
import numpy as np

# Check for CUDA, but default to CPU as requested
device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')

def get_face_detector():
    """
    Returns the MTCNN face detector.
    """
    # keep_all=False ensures we get the most prominent face or we can handle multiple.
    # For registration, we generally expect one face. 
    # For live recognition, we crop first, so we expect one face in the crop.
    return MTCNN(keep_all=False, select_largest=True, device=device)

def get_face_encoder():
    """
    Returns the InceptionResnetV1 model for generating embeddings.
    """
    resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)
    return resnet

def extract_face_tensor(img, detector):
    """
    Detects a face in the image and returns the cropped face tensor.
    img: PIL Image or numpy array (RGB)
    
    Returns:
        face_tensor (torch.Tensor) or None if no face detected
    """
    # MTCNN expects PIL image or numpy array (RGB)
    # returns tensor of shape (3, 160, 160) approx if steps not defined? 
    # By default facenet-pytorch mtcnn returns a tensor normalized to [-1, 1] if return_prob=False
    return detector(img)

def get_embedding(face_tensor, encoder):
    """
    Generates a normalized embedding for a given face tensor.
    face_tensor: Tensor of shape (3, H, W) or (N, 3, H, W)
    
    Returns:
        embedding (numpy array): Normalized 512-d embedding
    """
    if face_tensor is None:
        return None
    
    # Ensure tensor has batch dimension
    if face_tensor.ndim == 3:
        face_tensor = face_tensor.unsqueeze(0)
    
    face_tensor = face_tensor.to(device)
    
    with torch.no_grad():
        embedding = encoder(face_tensor).detach().cpu().numpy()
        
    # Normalize embedding (essential for cosine similarity / IP in FAISS)
    # FAISS IndexFlatIP calculates inner product. 
    # For normalized vectors, Inner Product == Cosine Similarity.
    norm = np.linalg.norm(embedding, axis=1, keepdims=True)
    embedding = embedding / (norm + 1e-10)
    
    return embedding.flatten()
