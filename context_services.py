import database


def build_team_context():
    employees = database.list_employees()
    records = database.list_communication_records()
    todos = database.list_todos()
    risk_signals = database.list_risk_signals()
    focus = [
        employee
        for employee in employees
        if employee["level"] in ("高风险", "中风险")
        or employee.get("risk", 0) >= 40
        or employee.get("modelRequired")
        or employee.get("analysisStatus") in ("待模型精算", "待分析")
    ]
    covered_names = {record["employee"] for record in records if record.get("employee")}
    coverage = round((len(covered_names) / len(employees)) * 100) if employees else 0

    return {
        "summary": {
            "team_size": len(employees),
            "focus_count": len(focus),
            "pending_actions": len(todos),
            "communication_coverage": f"{coverage}%",
        },
        "employees": employees,
        "communication_records": records[:20],
        "todos": todos[:10],
        "risk_signals": risk_signals[:50],
    }


def build_focus_context():
    context = build_team_context()
    employees = context["employees"]
    focus = [
        employee
        for employee in employees
        if employee["level"] in ("高风险", "中风险")
        or employee.get("risk", 0) >= 40
        or employee.get("modelRequired")
        or employee.get("analysisStatus") in ("待模型精算", "待分析")
    ]
    focus_keys = {employee["key"] for employee in focus}
    focus_names = {employee["name"] for employee in focus}
    records = [
        record
        for record in context["communication_records"]
        if record["employeeKey"] in focus_keys or record["employee"] in focus_names
    ]
    todos = [todo for todo in context["todos"] if not todo.get("employeeKey") or todo["employeeKey"] in focus_keys]
    return {
        "summary": context["summary"],
        "focus_employees": focus,
        "related_communication_records": records,
        "related_todos": todos,
        "related_risk_signals": [
            signal for signal in context.get("risk_signals", []) if signal["employeeKey"] in focus_keys
        ],
    }


def get_metrics():
    context = build_team_context()
    summary = context["summary"]
    return {
        "items": [
            {"key": "team", "label": "员工档案", "value": str(summary["team_size"]), "detail": "已录入基础信息", "tone": "pink"},
            {"key": "focus", "label": "重点关注", "value": str(summary["focus_count"]), "detail": "系统识别对象", "tone": "blue"},
            {"key": "todo", "label": "待办动作", "value": str(summary["pending_actions"]), "detail": "风险与节点生成", "tone": "green"},
            {"key": "coverage", "label": "沟通覆盖", "value": summary["communication_coverage"], "detail": "来自沟通记录", "tone": "amber"},
        ],
        "source": "SQLite 实时统计",
    }


def get_archive():
    return {
        "employees": database.list_employees(),
        "communicationRecords": database.list_communication_records(),
        "todos": database.list_todos(),
        "riskSignals": database.list_risk_signals(),
        "metrics": get_metrics()["items"],
    }
