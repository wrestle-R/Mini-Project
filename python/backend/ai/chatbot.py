"""
Architectural Chatbot: Convert natural language instructions to structured JSON actions.
Uses LangChain + Groq LLM with strict JSON validation.

Supported Actions:
- add_element: Add new element to model
- remove_element: Remove element by ID
- update_property: Update element property value
- transform_element: Move, rotate, or scale element
- duplicate_element: Clone element with new ID
- add_colour: Add/update element color

Target Handling:
- If "element_id" present: operate on single element
- If "target": "wall" present: apply to all elements of that type
"""

import os
import json
from typing import Dict, Any, Optional, List
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
from pydantic import SecretStr

load_dotenv()


# Allowed values (constraints for validation)
ALLOWED_ELEMENT_TYPES = ["wall", "column", "slab", "door", "window", "beam", "roof", "space", "stair", "member"]
ALLOWED_ACTIONS = ["add_element", "remove_element", "update_property", "transform_element", "duplicate_element", "add_colour"]
ALLOWED_PROPERTIES = ["height", "width", "depth", "thickness", "material", "color"]
NON_EXECUTABLE_ACTIONS = {"none", "no_action", "noop", "null", "n/a", ""}


class ActionValidationError(Exception):
    """Raised when action JSON doesn't meet schema requirements."""
    pass


def validate_action_json(action_dict: Dict[str, Any]) -> None:
    """
    Validate action JSON against schema.
    Raises ActionValidationError if invalid.
    """
    action_type = action_dict.get("action")
    
    # Validate action type
    _validate_action_type(action_type)
    
    # Validate element type
    element_type = action_dict.get("element_type")
    if element_type:
        _validate_element_type(element_type)
    
    # Validate target
    target = action_dict.get("target")
    if target:
        _validate_element_type(target)
    
    # Validate property if present
    if "property" in action_dict:
        _validate_property_name(action_dict["property"])


def _validate_action_type(action: str | None) -> None:
    """Validate action is in allowed list."""
    if action not in ALLOWED_ACTIONS:
        raise ActionValidationError(
            f"Invalid action '{action}'. Must be one of: {', '.join(ALLOWED_ACTIONS)}"
        )


def _validate_element_type(elem_type: str) -> None:
    """Validate element type is in allowed list."""
    if elem_type not in ALLOWED_ELEMENT_TYPES:
        raise ActionValidationError(
            f"Invalid element type '{elem_type}'. Must be one of: {', '.join(ALLOWED_ELEMENT_TYPES)}"
        )


def _validate_property_name(prop: str) -> None:
    """Validate property name is in allowed list."""
    if prop not in ALLOWED_PROPERTIES:
        raise ActionValidationError(
            f"Invalid property '{prop}'. Must be one of: {', '.join(ALLOWED_PROPERTIES)}"
        )


class ArchitecturalChatbot:
    """
    LLM-powered chatbot for architectural instructions.
    Converts natural language to structured JSON actions.
    """
    
    def __init__(self, model: str = "llama-3.3-70b-versatile", temperature: float = 0.0):
        """
        Initialize chatbot with Groq LLM.
        
        Args:
            model: Groq model name
            temperature: LLM temperature (0.0 = deterministic)
        """
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
        
        self.llm = ChatGroq(
            api_key=SecretStr(api_key),
            model=model,
            temperature=temperature
        )
    
    def parse_instruction(self, message: str, contexts: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Parse natural language instruction to JSON action.
        
        Args:
            message: User instruction (e.g., "Make all walls 4 meters tall")
            contexts: Optional list of dicts with selected element context e.g. [{"element_id": "...", "element_type": "..."}]
            
        Returns:
            Validated action dictionary
            
        Raises:
            ActionValidationError: If action fails validation
        """
        template_str = """You are an expert agentic architectural assistant. Create a precise plan and execute modifications.
Convert natural language into EXACTLY ONE JSON object matching the SCHEMA.

SPATIAL ORIENTATION GUIDE (WORLD COORDINATES):
- +X: RIGHT (e.g., "move right")
- -X: LEFT (e.g., "move left")
- +Y: FRONT / FORWARD (e.g., "move forward")
- -Y: BACK / AWAY (e.g., "move back")
- +Z: UP (e.g., "lift up", "move higher")
- -Z: DOWN (e.g., "move lower")

ACTION PRIORITIES:
1. GEOMETRY: If asked to "extend" or "lengthen", prioritize `update_property` on "width" or "depth".
2. RELATIVE MOVEMENT: If the user says "more", "further", "additional", "another X meters", you MUST use `translation_relative` ([dx, dy, dz]). 
   - Example: "move left 50m more" -> {{"action": "transform_element", "translation_relative": [-50, 0, 0]}}
3. ABSOLUTE MOVEMENT: If user says "move to [coord]" or "set position to", use `translation` ([x, y, z]).

SUPPORTED ACTIONS:
1. add_element / 2. remove_element
3. update_property: Parametric resizing (height, width, depth, thickness) or material/color.
4. transform_element: 
    - Use "translation" for absolute targets.
    - Use "translation_relative" ([dx, dy, dz]) for relative shifts.
    - Use "scale": [sx, sy, sz] for uniform/non-uniform growth.
5. duplicate_element / 6. add_colour

Rules:
- Target "this", "it", or "that" using the first GlobalID in CONTEXT PINS.
- Respond with exactly ONE JSON object.

SCHEMA:
{{
  "explanation": "concise description of work",
  "plan": ["step 1", "step 2"],
  "actions": [{{ "action": "...", ... }}]
}}

EXAMPLES:
- "move it 10m more to the right" -> {{"translation_relative": [10, 0, 0]}}
- "extend the wall depth by 5 meters" -> {{"action": "update_property", "property": "depth", "value": 5}}
- "lift the roof up 2.5m" -> {{"translation_relative": [0, 0, 2.5]}}
- "shift everything 2m back" -> {{"target": "wall", "translation_relative": [0, -2, 0]}}

{context_block}

User Instruction: {instruction}

Respond ONLY with JSON matching the SCHEMA."""
        
        prompt = ChatPromptTemplate.from_template(template_str)
        chain = prompt | self.llm

        context_str = ""
        if contexts and len(contexts) > 0:
            context_str = "CONTEXT PINS: The user has ACTIVELY SELECTED the following items:\n"
            for idx, c in enumerate(contexts):
                context_str += f"- [Pin {idx+1}] {c.get('element_type', 'element').upper()} with GlobalID: {c.get('element_id')}\n"

        def _invoke_and_parse(instruction_text: str) -> Dict[str, Any]:
            response = chain.invoke({
                "instruction": instruction_text,
                "context_block": context_str
            })
            raw_content = response.content
            if isinstance(raw_content, str):
                response_text = raw_content.strip()
            else:
                # Handle providers that return structured content blocks.
                response_text = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in raw_content
                ).strip()

            # Clean markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            try:
                # If there are multiple objects or trailing text, raw_decode extracts the first valid JSON
                decoder = json.JSONDecoder()
                # Find start of JSON object to avoid leading text
                start_idx = response_text.find('{')
                if start_idx == -1:
                    raise ActionValidationError("No JSON object found in response.")
                parsed, _ = decoder.raw_decode(response_text[start_idx:])
                return parsed
            except json.JSONDecodeError as e:
                raise ActionValidationError(f"Failed to parse LLM response as JSON: {e}\nRaw: {response_text}")

        response_dict = _invoke_and_parse(message)
        
        # Verify the structure has "actions" list
        if "actions" not in response_dict or not isinstance(response_dict["actions"], list):
            raise ActionValidationError("LLM response missing 'actions' list property.")

        return response_dict


# Global singleton
_chatbot_instance: Optional[ArchitecturalChatbot] = None


def get_chatbot() -> ArchitecturalChatbot:
    """Get or create global chatbot instance."""
    global _chatbot_instance
    
    if _chatbot_instance is None:
        _chatbot_instance = ArchitecturalChatbot()
    
    return _chatbot_instance


# Convenience function
def parse_instruction(message: str, contexts: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """Parse instruction using global chatbot instance."""
    return get_chatbot().parse_instruction(message, contexts)
