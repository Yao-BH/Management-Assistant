import json
import urllib.error

import database
from context_services import get_archive
from prompts import COMMUNICATION_SUMMARY_SYSTEM_PROMPT
from profile_services import analyze_changed_employee
from service_common import client, model_source, parse_json_object


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


def remove_communication(record_id):
    deleted = database.delete_communication_record(record_id)
    if not deleted:
        raise ValueError("Communication record not found")
    employee_key = deleted.get("employeeKey")
    if employee_key:
        analyze_changed_employee(employee_key)
    return {"record": deleted, "archive": get_archive()}


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


def _employee_records(employee):
    if not employee:
        return []
    return [
        record
        for record in database.list_communication_records()
        if record.get("employeeKey") == employee.get("key")
        or record.get("employee") == employee.get("name")
        or record.get("employeeName") == employee.get("name")
    ][:8]


def _todo_by_id(todo_id):
    return next((todo for todo in database.list_todos() if str(todo.get("id")) == str(todo_id)), None)


def _summary_fallback(employee, todo, records):
    if not employee:
        return ["未定位到员工，请先选择一项带员工信息的待办。"]
    evidence = employee.get("riskSignals") or []
    labels = [
        f"{item.get('label')}：{item.get('value')}"
        if item.get("label") and item.get("value") and item.get("label") != item.get("value")
        else item.get("label") or item.get("value")
        for item in evidence
        if item.get("label") or item.get("value")
    ] or employee.get("evidence") or employee.get("riskFactors") or []
    return [
        f"{employee['name']}当前为{employee.get('level', '待分析')}，本次沟通应围绕待办“{(todo or {}).get('title') or employee.get('suggestedAction') or '状态确认'}”展开。",
        f"关键证据：{'；'.join(labels[:3]) or employee.get('reason') or '暂无完整证据'}。",
        f"最近沟通：{records[0].get('date') + '，' + records[0].get('summary', '') if records else '暂无沟通记录，需要本次补齐员工反馈'}。",
        f"建议记录：员工真实原因、续签/绩效/考勤等节点确认结果、下一次跟进时间。",
    ]


def generate_communication_summary(employee_key=None, todo_id=None):
    todo = _todo_by_id(todo_id) if todo_id else None
    resolved_key = employee_key or (todo or {}).get("employeeKey") or ""
    employee = database.get_employee(resolved_key) if resolved_key else None
    records = _employee_records(employee)
    prompt = {
        "employee": employee,
        "todo": todo,
        "recent_communication_records": records,
    }
    try:
        content = client.chat(
            [
                {"role": "system", "content": COMMUNICATION_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
        )
        data = parse_json_object(content) if content else {}
        lines = data.get("lines") or _summary_fallback(employee, todo, records)
        return {"lines": lines[:6], "source": model_source() if content else "SQLite 本地分析"}
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {"lines": _summary_fallback(employee, todo, records), "source": "SQLite 本地分析"}
