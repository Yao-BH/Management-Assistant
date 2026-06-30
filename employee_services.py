import database
from context_services import get_archive
from profile_services import analyze_changed_employee


def save_employee(employee):
    saved = database.upsert_employee(employee)
    analyze_changed_employee(saved["key"])
    return {"employee": saved, "archive": get_archive()}


def remove_employee(employee_key):
    deleted = database.delete_employee(employee_key)
    if not deleted:
        raise ValueError("Employee not found")
    return {"employee": deleted, "archive": get_archive()}


def import_employees(employees):
    saved = []
    for employee in employees:
        item = database.upsert_employee(employee)
        analyze_changed_employee(item["key"], use_model=False)
        saved.append(database.get_employee(item["key"]))
    return {"employees": saved, "archive": get_archive()}
