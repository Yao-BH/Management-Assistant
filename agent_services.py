import json
import urllib.error

import database
from data import FALLBACK_BRIEF, FALLBACK_OUTLINES, FALLBACK_PROFILES, FALLBACK_TODOS
from llm_client import DeepSeekClient
from prompts import BRIEF_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, OUTLINE_SYSTEM_PROMPT, PROFILE_SYSTEM_PROMPT, TODO_SYSTEM_PROMPT
from text_utils import parse_json_object, parse_lines


client = DeepSeekClient()


def model_source():
    return f"DeepSeek · {client.model}"


def build_team_context():
    employees = database.list_employees()
    records = database.list_communication_records()
    todos = database.list_todos()
    focus = [employee for employee in employees if employee["level"] in ("高风险", "中风险")]
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
    }


def get_archive():
    return {
        "employees": database.list_employees(),
        "communicationRecords": database.list_communication_records(),
        "todos": database.list_todos(),
        "metrics": get_metrics()["items"],
    }


def save_employee(employee):
    saved = database.upsert_employee(employee)
    return {"employee": saved, "archive": get_archive()}


def import_employees(employees):
    saved = [database.upsert_employee(employee) for employee in employees]
    return {"employees": saved, "archive": get_archive()}


def save_communication(record):
    saved = database.add_communication_record(record)
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
    return {"record": saved, "archive": get_archive()}


def update_todo_status(todo_id, status):
    if status not in ("待处理", "处理中", "已完成", "已忽略"):
        raise ValueError("Invalid todo status")
    todo = database.update_todo_status(todo_id, status)
    if not todo:
        raise ValueError("Todo not found")
    return {"todo": todo, "archive": get_archive()}


def get_metrics():
    context = build_team_context()
    summary = context["summary"]
    team_count = summary["team_size"]
    focus_count = summary["focus_count"]
    todos_count = summary["pending_actions"]
    coverage = summary["communication_coverage"]
    return {
        "items": [
            {"key": "team", "label": "员工档案", "value": str(team_count), "detail": "已录入基础信息", "tone": "pink"},
            {"key": "focus", "label": "重点关注", "value": str(focus_count), "detail": "系统识别对象", "tone": "blue"},
            {"key": "todo", "label": "待办动作", "value": str(todos_count), "detail": "风险与节点生成", "tone": "green"},
            {"key": "coverage", "label": "沟通覆盖", "value": coverage, "detail": "来自沟通记录", "tone": "amber"},
        ],
        "source": "SQLite 实时统计",
    }


def fallback_outline_for(employee):
    return FALLBACK_OUTLINES.get(employee.get("name"), FALLBACK_OUTLINES["张三"])


def generate_outline(employee_key=None, employee=None):
    employee = employee or database.get_employee(employee_key)
    if not employee:
        return {"lines": ["请选择一名员工后再生成沟通提纲。"], "source": "本地智能模板"}

    records = [record for record in database.list_communication_records() if record["employeeKey"] == employee["key"] or record["employee"] == employee["name"]]
    prompt = {"employee": employee, "communication_records": records[:8]}

    try:
        content = client.chat(
            [
                {"role": "system", "content": OUTLINE_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
        )
        if not content:
            return {"lines": fallback_outline_for(employee), "source": "本地智能模板"}

        lines = parse_lines(content)
        return {"lines": lines or fallback_outline_for(employee), "source": model_source()}
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {"lines": fallback_outline_for(employee), "source": "本地智能模板"}


def generate_brief():
    context = build_team_context()
    try:
        content = client.chat(
            [
                {"role": "system", "content": BRIEF_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
        )
        if not content:
            return local_brief(context)

        data = parse_json_object(content)
        return {
            "title": data.get("title") or FALLBACK_BRIEF["title"],
            "summary": data.get("summary") or local_brief(context)["summary"],
            "insights": (data.get("insights") or local_brief(context)["insights"])[:3],
            "source": model_source(),
        }
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return local_brief(context)


def local_brief(context):
    summary = context["summary"]
    focus = [employee for employee in context["employees"] if employee["level"] in ("高风险", "中风险")]
    top = focus[0] if focus else None
    title = "今日管理研判"
    body = (
        f"当前团队共 {summary['team_size']} 人，重点关注 {summary['focus_count']} 人，"
        f"沟通覆盖率 {summary['communication_coverage']}。"
    )
    if top:
        body += f"建议优先处理 {top['name']}：{top['suggestedAction'] or top['reason']}"
    return {
        "title": title,
        "summary": body,
        "insights": [
            {"label": "团队规模", "value": f"{summary['team_size']} 人", "detail": "来自员工档案"},
            {"label": "重点关注", "value": f"{summary['focus_count']} 人", "detail": top["name"] if top else "暂无高风险对象"},
            {"label": "待办动作", "value": f"{summary['pending_actions']} 项", "detail": "来自风险与沟通记录"},
        ],
        "source": "SQLite 本地统计",
    }


def generate_todos():
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
    return items or FALLBACK_TODOS["items"]


def level_to_todo_level(level):
    if level == "高风险":
        return "high"
    if level == "中风险":
        return "medium"
    return "low"


def fallback_profile_for(employee):
    lifecycle = employee.get("lifecycle") or {}
    if isinstance(lifecycle, str):
        lifecycle = {"stage": lifecycle, "detail": ""}
    return FALLBACK_PROFILES.get(employee.get("name"), {
        "riskSummary": employee.get("reason") or "当前员工缺少足够分析数据，建议补充沟通记录、绩效或关键节点。",
        "evidence": employee.get("evidence") or ["基础档案已录入", "等待 AI 分析"],
        "performance": employee.get("performance") or "待分析",
        "attendance": employee.get("attendance") or "待分析",
        "communication": employee.get("communication") or "待分析",
        "suggestedAction": employee.get("suggestedAction") or "补充信息后重新分析",
        "lifecycleStage": lifecycle.get("stage", "待分析"),
        "lifecycleDetail": lifecycle.get("detail", "需要根据入职时间和沟通记录判断生命周期。"),
    })


def generate_employee_profile(employee_key=None, employee=None, persist=False):
    employee = employee or database.get_employee(employee_key)
    if not employee:
        return {"error": "员工不存在", "source": "系统"}

    records = [record for record in database.list_communication_records() if record["employeeKey"] == employee["key"] or record["employee"] == employee["name"]]
    prompt = {"employee": employee, "communication_records": records[:8]}

    try:
        content = client.chat(
            [
                {"role": "system", "content": PROFILE_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
        )
        if not content:
            profile = local_profile(employee, records)
        else:
            data = parse_json_object(content)
            fallback = fallback_profile_for(employee)
            profile = {
                "risk": data.get("risk") or infer_risk_score(employee, records),
                "level": data.get("level") or infer_level(infer_risk_score(employee, records)),
                "riskSummary": data.get("riskSummary") or fallback["riskSummary"],
                "evidence": data.get("evidence") or fallback["evidence"],
                "performance": data.get("performance") or fallback["performance"],
                "attendance": data.get("attendance") or fallback["attendance"],
                "communication": data.get("communication") or fallback["communication"],
                "suggestedAction": data.get("suggestedAction") or fallback["suggestedAction"],
                "lifecycleStage": data.get("lifecycleStage") or fallback["lifecycleStage"],
                "lifecycleDetail": data.get("lifecycleDetail") or fallback["lifecycleDetail"],
                "source": model_source(),
            }
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        profile = local_profile(employee, records)

    if persist:
        updated = database.save_analysis(employee["key"], profile)
        return {"employee": updated, "profile": profile, "archive": get_archive()}
    return {**profile, "source": profile.get("source", "SQLite 本地分析")}


def local_profile(employee, records):
    risk = infer_risk_score(employee, records)
    level = infer_level(risk)
    record_hint = f"已有 {len(records)} 条沟通记录" if records else "暂无沟通记录"
    lifecycle = employee.get("lifecycle") or {}
    if isinstance(lifecycle, str):
        lifecycle = {"stage": lifecycle, "detail": ""}
    return {
        "risk": risk,
        "level": level,
        "riskSummary": employee.get("reason") or f"{employee['name']}当前信息量有限，{record_hint}，建议补充绩效、考勤和近期沟通信息后复核。",
        "evidence": employee.get("evidence") or ["员工基础档案已录入", record_hint],
        "performance": employee.get("performance") or "待分析",
        "attendance": employee.get("attendance") or "待分析",
        "communication": f"{len(records)} 条沟通记录" if records else "暂无沟通记录",
        "suggestedAction": employee.get("suggestedAction") if employee.get("suggestedAction") != "待分析" else "补充沟通记录并安排一次状态确认",
        "lifecycleStage": lifecycle.get("stage", "待分析"),
        "lifecycleDetail": lifecycle.get("detail", "系统将结合入职时间、沟通记录和节点信息判断员工生命周期。"),
        "source": "SQLite 本地分析",
    }


def infer_risk_score(employee, records):
    if employee.get("risk"):
        return employee["risk"]
    score = 35
    if not records:
        score += 15
    if employee.get("hireDate"):
        score += 0
    if "待分析" in (employee.get("analysisStatus") or ""):
        score += 8
    return min(score, 80)


def infer_level(score):
    if score >= 75:
        return "高风险"
    if score >= 55:
        return "中风险"
    return "低风险"


def fallback_chat_reply(message, context):
    focus = [employee for employee in context["employees"] if employee["level"] in ("高风险", "中风险")]
    for employee in context["employees"]:
        if employee["name"] in message:
            return f"{employee['name']}当前为{employee['level']}，风险分 {employee['risk']}。主要依据：{employee['reason'] or '基础信息不足'}。动作：{employee['suggestedAction']}。"
    if "优先" in message or "关注" in message:
        if focus:
            names = "、".join(employee["name"] for employee in focus[:3])
            return f"今天建议优先关注：{names}。动作：先处理最高风险员工的一对一沟通，再推进关键节点待办。"
        return "当前暂无高风险员工。动作：建议先补充沟通记录，并对待分析员工运行 AI 分析。"
    return "我会基于数据库中的员工档案、沟通记录和智能待办回答。你可以问某位员工为什么高风险，或让我生成今日优先级。"


def generate_chat_reply(message, history=None, intent=None):
    if not message:
        return {"reply": "请输入你想了解的员工、风险或管理动作。", "source": "本地智能模板", "actions": []}

    context = build_team_context()
    intent_hint = f"用户意图：{intent}。" if intent else ""
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "user", "content": intent_hint + "团队上下文：" + json.dumps(context, ensure_ascii=False)},
    ]
    messages.extend((history or [])[-6:])
    messages.append({"role": "user", "content": message})

    try:
        content = client.chat(messages)
        reply = content.strip() if content else fallback_chat_reply(message, context)
        return {"reply": reply, "source": model_source() if content else "SQLite 本地分析", "actions": suggest_actions(message, context)}
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {"reply": fallback_chat_reply(message, context), "source": "SQLite 本地分析", "actions": suggest_actions(message, context)}


def suggest_actions(message, context):
    employee = next((item for item in context["employees"] if item["name"] in message), None)
    if not employee:
        employee = next((item for item in context["employees"] if item["level"] in ("高风险", "中风险")), None)
    if not employee:
        return [{"type": "add_todo", "label": "加入待办"}]
    return [
        {"type": "outline", "label": "生成沟通提纲", "employeeKey": employee["key"]},
        {"type": "todo", "label": "加入待办", "employeeKey": employee["key"]},
        {"type": "profile", "label": "查看员工画像", "employeeKey": employee["key"]},
    ]


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
    return {"items": database.add_todo(item)}
