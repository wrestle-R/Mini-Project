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
from typing import Dict, Any, Optional
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
    
    def parse_instruction(self, message: str) -> Dict[str, Any]:
        """
        Parse natural language instruction to JSON action.
        
        Args:
            message: User instruction (e.g., "Make all walls 4 meters tall")
            
        Returns:
            Validated action dictionary
            
        Raises:
            ActionValidationError: If action fails validation
        """
        template_str = """You are an architectural assistant. Convert the user's natural language instruction into EXACTLY ONE JSON action object.

SUPPORTED ACTIONS:
1. add_element: Create new element
   {{"action": "add_element", "element_type": "wall|column|slab|...", "properties": {{...}}, "target": optional_type}}

2. remove_element: Delete element
   {{"action": "remove_element", "element_id": "ID" OR "target": "element_type"}}

3. update_property: Modify element property
   {{"action": "update_property", "property": "height|width|depth|thickness|material|color", "value": number_or_string, "element_id": "ID" OR "target": "element_type"}}

4. transform_element: Move, rotate, or scale
   {{"action": "transform_element", "element_id": "ID" OR "target": "element_type", "translation": [x,y,z] OR "rotation": [x,y,z,w] OR "scale": [sx,sy,sz]}}

5. duplicate_element: Clone element
   {{"action": "duplicate_element", "element_id": "ID", "count": number}}

6. add_colour: Set element color
   {{"action": "add_colour", "element_id": "ID" OR "target": "element_type", "color": [r,g,b]}}

ELEMENT TYPES: wall, column, slab, door, window, beam, roof, space, stair, member

Rules:
- If instruction targets a TYPE (e.g., "all walls"), use "target": "type_name"
- If instruction targets SINGLE element, use "element_id"
- If user instruction implies multiple actions, pick the PRIMARY or FIRST executable action.
- Always respond with exactly ONE valid JSON object only. Do NOT return multiple objects, arrays, or text.
- Include "reason" field explaining the action

User instruction: {instruction}

Respond ONLY with a single JSON object. No explanation, no markdown."""
        
        prompt = ChatPromptTemplate.from_template(template_str)
        chain = prompt | self.llm

        def _invoke_and_parse(instruction_text: str) -> Dict[str, Any]:
            response = chain.invoke({"instruction": instruction_text})
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

        action_dict = _invoke_and_parse(message)
        action_value = str(action_dict.get("action", "")).strip().lower()

        # Retry once with stronger instruction if model returns non-executable action.
        if action_value in NON_EXECUTABLE_ACTIONS:
            strict_message = (
                f"{message}\n\n"
                "IMPORTANT: Return an executable action only. "
                f"Action MUST be one of: {', '.join(ALLOWED_ACTIONS)}. "
                "Do NOT return none/noop/no_action."
            )
            action_dict = _invoke_and_parse(strict_message)
            action_value = str(action_dict.get("action", "")).strip().lower()

        if action_value in NON_EXECUTABLE_ACTIONS:
            raise ActionValidationError(
                "Instruction could not be mapped to an executable model action. "
                f"Use a concrete edit request (allowed: {', '.join(ALLOWED_ACTIONS)})."
            )

        validate_action_json(action_dict)
        return action_dict


# Global singleton
_chatbot_instance: Optional[ArchitecturalChatbot] = None


def get_chatbot() -> ArchitecturalChatbot:
    """Get or create global chatbot instance."""
    global _chatbot_instance
    
    if _chatbot_instance is None:
        _chatbot_instance = ArchitecturalChatbot()
    
    return _chatbot_instance


# Convenience function
def parse_instruction(message: str) -> Dict[str, Any]:
    """Parse instruction using global chatbot instance."""
    return get_chatbot().parse_instruction(message)
