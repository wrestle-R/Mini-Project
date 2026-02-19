def get_employee_details(employee_id):
    """
    Simulates a database lookup for employee details.
    
    Args:
        employee_id (str): The ID of the employee to look up.
        
    Returns:
        dict: A dictionary containing employee details.
    """
    # In a real application, you would query your SQL/NoSQL database here.
    # Example:
    # user = db.query("SELECT * FROM employees WHERE id = ?", employee_id)
    # return user
    
    return {
        "id": employee_id,
        "name": f"Employee {employee_id}", # Placeholder name
        "role": "Worker",
        "department": "Engineering" # Example extra field
    }
