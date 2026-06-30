import database
from context_services import get_archive
from profile_services import analyze_changed_employee


def save_communication(record):
    saved = database.add_communication_record(record)
    if saved.get("employeeKey"):
        analyze_changed_employee(saved["employeeKey"])
    return {"record": saved, "archive": get_archive()}


def update_communication(record_id, updates):
    saved = database.update_communication_record(record_id, updates)
    if not saved:
        raise ValueError("Communication record not found")
    return {"record": saved, "archive": get_archive()}


def complete_communication_workflow(record, todo_id=None):
    saved = database.add_communication_record(record)
    employee_key = saved.get("employeeKey") or record.get("employeeKey", "")
    if todo_id:
        database.update_todo_status(todo_id, "已完成")
    elif employee_key:
        database.complete_employee_todos(employee_key)
    if employee_key:
        analyze_changed_employee(employee_key)
    return {"record": saved, "archive": get_archive()}
