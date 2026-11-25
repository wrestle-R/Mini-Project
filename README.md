# InfraSaathi: AI-Driven GIS Spatial Intelligence

InfraSaathi is a sophisticated GIS platform designed for intelligent land selection and architectural site validation. It combines real-world OpenStreetMap (OSM) data with agentic AI reasoning and 3D visualization to help engineers and developers find the perfect construction sites.

## 🚀 Key Features

### 1. Agentic Spatial Intelligence
- **Natural Language Interaction**: A LangGraph-powered AI agent handles complex spatial queries like *"Find 5000sqm of empty land near a forest in Mumbai"*.
- **Multi-Tool reasoning**: The agent uses geocoding, OSM context fetching, and custom scoring engines to rank candidate parcels.
- **Contextual Understanding**: Handles proximity to highways, forests, water bodies, and existing urban infrastructure.

### 2. 2.5D/3D Interactive Mapping
- **MapLibre GL Integration**: High-performance vector map rendering with professional GIS controls (Satellite/Streets/Terrain).
- **3D IFC/GLB Visualization**: Overlay architectural models directly onto the map with precise georeferencing.
- **Dynamic Orientation**: Automated detection of model up-axis (Y-up vs Z-up) and manual rotation/offset controls.

### 3. Automated Site Suitability & Fit Validation
- **Building Collision Detection**: Rigorous geometric intersection checks to prevent model placement over existing structures.
- **Road & Nature Proximity**: Real-time scoring based on accessibility and environmental factors.
- **Utilization Analysis**: Calculates exactly how much of a land parcel is covered by the model footprint in square meters.
- **Suggested Optimizations**: Automatically suggests the best rotation angle to maximize fit within a parcel.

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Mapping**: MapLibre GL JS + MapTiler SDK
- **3D Rendering**: Three.js + GLTFLoader
- **Styling**: Tailwind CSS + Lucide Icons
- **State Management**: React Hooks + Event Bus

### Backend
- **API Framework**: FastAPI (Python)
- **Geometry Logic**: Shapely (Rigorous polygon intersection & analysis)
- **AI Agent**: LangChain / LangGraph (Orchestration) + ChatGroq (LLM)
- **Data Source**: OpenStreetMap (Overpass QL)
- **Geocoding**: Nominatim

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MapTiler API Key
- Groq API Key

### Backend Setup
1. Navigate to the `python/` directory.
2. Install dependencies:
   ```bash
   pip install fastapi uvicorn shapely langchain-groq langgraph
   ```
3. Create a `.env` file and add your `GROQ_API_KEY`.
4. Start the server:
   ```bash
   python main.py
   ```

### Frontend Setup
1. Navigate to the `next-app/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Add your `NEXT_PUBLIC_MAPTILER_KEY` to `.env.local`.
4. Run the development server:
   ```bash
   npm run dev
   ```

## 🏗 Workflow
1. **Discover**: Ask the Chatbot to find suitable land in a specific region.
2. **Select**: Draw or select a parcel from the map suggestions.
3. **Load**: Upload an IFC/GLB model of your proposed building.
4. **Validate**: Click "Validate" to check for building collisions, road access, and parcel fit.
5. **Optimize**: Adjust rotation and offset until the validation turns green.

---
*Built with ❤️ for Civil Engineers and Urban Planners.*
