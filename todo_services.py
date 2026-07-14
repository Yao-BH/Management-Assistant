import json
import urllib.error

import database
from context_services import build_team_context, get_archive
from prompts import TODO_SYSTEM_PROMPT
from risk_engine import rule_profile
from service_common import client, model_source, parse_json_object


def level_to_todo_level(level):
    if level == "高风险":
        return "high"
    if level == "中风险":
        return "medium"
    return "low"


def local_todos(context):
    items = []
    for index, employee in enumerate(context["employees"], start=1):
        if employee["level"] not in ("高风险", "中风险") and employee["analysisStatus"] == "待分析":
            continue
        items.append(
            {
                "id": f"todo-{employee['key']}",
                "employeeKey": employee["key"],
                "priority": f"P{min(index, 5)}",
                "title": employee["suggestedAction"] if employee["suggestedAction"] != "待分析" else f"完成{employee['name']}员工画像分析",
                "badge": employee["level"],
                "summary": employee["reason"] or "员工已录入，建议补充沟通记录后进行 AI 分析。",
                "tags": [employee["department"], employee["analysisStatus"]],
                "level": level_to_todo_level(employee["level"]),
            }
        )
    return items


def should_have_focus_todo(employee):
    return employee["level"] in ("高风险", "中风险") or employee.get("risk", 0) >= 40 or employee.get("modelRequired")


def todo_from_employee(employee):
    signals = employee.get("riskSignals") or []
    evidence = [
        f"{signal.get('label')}：{signal.get('value')}" if signal.get("label") and signal.get("value") and signal.get("label") != signal.get("value") else signal.get("label") or signal.get("value")
        for signal in signals
    ] or employee.get("evidence") or employee.get("riskFactors") or []
    return {
        "id": f"system-{employee['key']}",
        "employeeKey": employee["key"],
        "priority": "P1" if employee["level"] == "高风险" else "P2" if employee["level"] == "中风险" else "P3",
        "title": employee.get("suggestedAction") if employee.get("suggestedAction") != "待分析" else f"跟进{employee['name']}员工状态",
        "badge": employee["level"],
        "summary": employee.get("reason") or "规则扫描发现该员工需要关注。",
        "tags": evidence[:4] or [employee.get("department", ""), employee.get("analysisStatus", "")],
        "level": level_to_todo_level(employee["level"]),
    }


def sync_employee_todo(employee):
    if should_have_focus_todo(employee):
        return database.sync_employee_system_todo(employee["key"], todo_from_employee(employee))
    return database.sync_employee_system_todo(employee["key"], None)


def recalculate_risk_state():
    records = database.list_communication_records()
    for employee in database.list_employees():
        profile = rule_profile(employee, records)
        updated = database.save_rule_analysis(employee["key"], profile, model_required=employee.get("modelRequired", False))
        sync_employee_todo(updated)
    return get_archive()


def generate_todos():
    recalculate_risk_state()
    context = build_team_context()
    try:
        content = client.chat(
            [
                {"role": "system", "content": TODO_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
        )
        if not content:
            return {"items": database.list_todos() or local_todos(context), "source": "SQLite 本地统计"}

        data = parse_json_object(content)
        items = data.get("items") or local_todos(context)
        stored = database.replace_todos(items[:5])
        return {"items": stored[:5], "source": model_source()}
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {"items": database.list_todos() or local_todos(context), "source": "SQLite 本地统计"}


def update_todo_status(todo_id, status):
    if status not in ("待处理", "处理中", "已完成", "已忽略"):
        raise ValueError("Invalid todo status")
    todo = database.update_todo_status(todo_id, status)
    if not todo:
        raise ValueError("Todo not found")
    return {"todo": todo, "archive": get_archive()}


def remove_todo(todo_id):
    todo = database.delete_todo(todo_id)
    if not todo:
        raise ValueError("Todo not found")
    return {"todo": todo, "archive": get_archive()}


def add_action_todo(employee_key):
    employee = database.get_employee(employee_key)
    if not employee:
        return {"items": database.list_todos()}
    item = {
        "employeeKey": employee_key,
        "priority": "P1" if employee["level"] == "高风险" else "P2",
        "title": employee["suggestedAction"] if employee["suggestedAction"] != "待分析" else f"跟进{employee['name']}员工状态",
        "badge": employee["level"],
        "summary": employee["reason"] or "由右侧 Agent 对话加入待办。",
        "tags": [employee["department"], "Agent 添加"],
        "level": level_to_todo_level(employee["level"]),
        "status": "待处理",
    }
    database.add_todo(item)
    return {"archive": get_archive()}
