import json
import urllib.error

import database
from prompts import CHAT_SYSTEM_PROMPT
from service_common import client, model_source


EMPTY_CONTEXT = {
    "summary": {},
    "employees": [],
    "communication_records": [],
    "todos": [],
    "risk_signals": [],
}


def infer_intent(message, explicit_intent=None):
    if explicit_intent:
        return explicit_intent
    text = message or ""
    stripped = text.strip()
    if stripped in ("你好", "您好", "嗨", "hi", "hello", "Hello", "HI") or any(word in text for word in ("在吗", "小达")):
        return "greeting"
    if any(word in text for word in ("你能做什么", "有什么功能", "功能", "你是谁", "怎么用", "能干什么", "你会什么")):
        return "capability_query"
    if any(word in text for word in ("怎么办", "怎么处理", "如何", "建议", "思路", "方法")) and any(
        word in text for word in ("管理", "员工", "团队", "焦虑", "冲突", "绩效", "沟通", "氛围", "压力")
    ):
        return "management_advice"
    if any(word in text for word in ("所有", "全部", "全员", "每个")) and any(word in text for word in ("风险", "状态", "员工")):
        return "risk_overview"
    if any(word in text for word in ("团队", "整体", "概况", "总览", "多少人", "人数")):
        return "team_summary"
    if any(word in text for word in ("优先", "先处理", "今天", "关注谁", "先关注")):
        return "today_priority"
    if any(word in text for word in ("为什么", "原因", "风险")):
        return "risk_reason"
    if any(word in text for word in ("待办", "动作", "安排", "跟进")):
        return "management_actions"
    if any(word in text for word in ("提纲", "沟通", "1 对 1", "一对一")):
        return "communication_outline"
    return "general"


def mentioned_employees(message, limit=5):
    text = message or ""
    matches = []
    seen = set()
    for item in database.list_employee_directory():
        keys = [item.get("name"), item.get("employeeId"), item.get("key")]
        if any(value and str(value) in text for value in keys):
            if item["key"] not in seen:
                matches.append(item)
                seen.add(item["key"])
        if len(matches) >= limit:
            break
    return matches


def compact_employee(employee):
    if not employee:
        return {}
    return {
        "key": employee.get("key"),
        "name": employee.get("name"),
        "employeeId": employee.get("employeeId"),
        "department": employee.get("department"),
        "role": employee.get("role"),
        "jobLevel": employee.get("jobLevel"),
        "manager": employee.get("manager"),
        "level": employee.get("level"),
        "risk": employee.get("risk"),
        "reason": employee.get("reason"),
        "evidence": employee.get("evidence", [])[:3],
        "riskSignals": employee.get("riskSignals", [])[:3],
        "performance": employee.get("performance"),
        "attendance": employee.get("attendance"),
        "communication": employee.get("communication"),
        "lifecycle": employee.get("lifecycle"),
        "suggestedAction": employee.get("suggestedAction"),
        "analysisStatus": employee.get("analysisStatus"),
    }


def employee_context(matches):
    employees = [compact_employee(database.get_employee(item["key"])) for item in matches]
    keys = [item.get("key") for item in employees if item.get("key")]
    records = []
    todos = []
    signals = []
    for key in keys:
        records.extend(database.list_communication_records(key, limit=5))
        todos.extend(database.list_todos(key, limit=5))
        signals.extend(database.list_risk_signals(key)[:8])
    return {
        "summary": {"matched_employee_count": len(employees)},
        "employees": employees,
        "communication_records": records[:12],
        "todos": todos[:12],
        "risk_signals": signals[:20],
    }


def team_snapshot_context(intent):
    if intent == "risk_overview":
        roster = database.list_employee_directory()
        return {
            "summary": database.team_summary(),
            "employees": roster,
            "communication_records": [],
            "todos": [],
            "risk_signals": [],
            "scope": "risk_roster_minimal",
        }

    focus = [compact_employee(employee) for employee in database.list_focus_employees(5)]
    focus_keys = {employee.get("key") for employee in focus if employee.get("key")}
    todos = [
        todo
        for todo in database.list_todos(limit=8)
        if not todo.get("employeeKey") or todo.get("employeeKey") in focus_keys
    ][:5]
    return {
        "summary": database.team_summary(),
        "employees": focus,
        "communication_records": [],
        "todos": todos,
        "risk_signals": [signal for signal in database.list_risk_signals()[:16] if not focus_keys or signal.get("employeeKey") in focus_keys][:10],
        "scope": intent,
    }


def build_chat_context(message, intent):
    if intent in ("greeting", "capability_query"):
        return {**EMPTY_CONTEXT, "scope": "agent_capability_only"}
    if intent == "management_advice":
        return {**EMPTY_CONTEXT, "scope": "management_knowledge_only"}

    matches = mentioned_employees(message)
    if matches:
        context = employee_context(matches)
        context["scope"] = "matched_employee_records"
        return context

    if intent in ("team_summary", "risk_overview", "today_priority", "management_actions", "communication_outline"):
        return team_snapshot_context(intent)

    return {**EMPTY_CONTEXT, "scope": "general_no_database_match"}


def chat_context_for_model(context):
    return {
        "summary": context.get("summary", {}),
        "scope": context.get("scope"),
        "employees": context.get("employees", [])[:8],
        "todos": context.get("todos", [])[:8],
        "communication_records": context.get("communication_records", [])[:8],
        "risk_signals": context.get("risk_signals", [])[:20],
    }


def focus_employees(context):
    employees = context.get("employees", [])
    focus = [
        employee
        for employee in employees
        if employee.get("level") in ("高风险", "中风险") or employee.get("risk", 0) >= 40 or employee.get("modelRequired")
    ]
    return sorted(focus, key=lambda item: item.get("risk", 0), reverse=True)


def format_greeting_reply(context):
    summary = context.get("summary", {})
    focus = focus_employees(context)
    top_names = "、".join(employee["name"] for employee in focus[:2])
    if top_names:
        return (
            f"你好，我在。当前团队共 {summary.get('team_size', 0)} 人，"
            f"{summary.get('focus_count', 0)} 人需要关注，优先可以先看 {top_names}。\n"
            "你可以直接问我：今天先处理谁、某位员工为什么有风险，或者帮我生成管理动作。"
        )
    return (
        f"你好，我在。当前团队共 {summary.get('team_size', 0)} 人，暂未识别到明确高风险对象。\n"
        "你可以问我团队概况、员工风险原因，或让小达帮你生成今天的管理动作。"
    )


def format_capability_reply(context):
    summary = context.get("summary", {})
    focus = focus_employees(context)
    top_names = "、".join(employee["name"] for employee in focus[:3]) or "暂无明确重点对象"
    return (
        f"**我主要帮你把团队风险变成可执行动作。**\n"
        f"1. 看优先级：当前 {summary.get('focus_count', 0)} 人需要关注，优先对象是 {top_names}\n"
        f"2. 查原因：解释某位员工的风险信号、证据和建议动作\n"
        f"3. 推进闭环：把风险转成待办、1 对 1 提纲和跟进安排\n"
        "你可以直接问：今天先处理谁？或者范宁为什么有风险？"
    )


def format_team_summary(context):
    summary = context.get("summary", {})
    focus = focus_employees(context)
    top_names = "、".join(employee["name"] for employee in focus[:3]) or "暂无"
    return (
        f"**当前团队重点关注 {summary.get('focus_count', 0)} 人。**\n"
        f"1. 团队共 {summary.get('team_size', 0)} 人，待办 {summary.get('pending_actions', 0)} 项\n"
        f"2. 沟通覆盖率 {summary.get('communication_coverage', '0%')}\n"
        f"3. 当前优先对象：{top_names}"
    )


def todo_priority_value(todo):
    priority = str(todo.get("priority") or "")
    if priority.upper().startswith("P"):
        try:
            return int(priority[1:])
        except ValueError:
            return 9
    level = todo.get("level")
    return {"high": 1, "medium": 2, "low": 3}.get(level, 9)


def priority_employee(context):
    employees = context.get("employees", [])
    by_key = {employee.get("key"): employee for employee in employees}
    active_todos = [
        todo
        for todo in context.get("todos", [])
        if "完成" not in str(todo.get("status") or "") and "关闭" not in str(todo.get("status") or "")
    ]
    for todo in sorted(active_todos, key=todo_priority_value):
        employee = by_key.get(todo.get("employeeKey"))
        if employee:
            return employee
    focus = focus_employees(context)
    return focus[0] if focus else None


def format_today_priority(context):
    top = priority_employee(context)
    if not top:
        return "**当前暂无明确高风险对象。**\n1. 建议先补充沟通记录\n2. 对待分析员工运行分析"
    evidence = evidence_labels(top)[:3]
    lines = "\n".join(f"{index}. {item}" for index, item in enumerate(evidence, start=1)) or "暂无完整证据。"
    return (
        f"**今天建议先关注 {top['name']}。**\n"
        f"{lines}\n"
        f"建议：{top.get('suggestedAction') or '安排一次状态确认，并记录后续动作。'}"
    )


def format_risk_reason(message, context):
    employee = select_employee(message, context)
    if not employee:
        return "**我还没定位到具体员工。**\n1. 你可以问：李四为什么有风险？\n2. 或问：今天先关注谁？"
    evidence = evidence_labels(employee)[:4]
    lines = "\n".join(f"{index}. {item}" for index, item in enumerate(evidence, start=1)) or "暂无完整证据。"
    return (
        f"**{employee['name']}当前为{employee.get('level', '待分析')}。**\n"
        f"{lines}\n"
        f"建议：{employee.get('suggestedAction') or '先补充沟通记录，再复核风险。'}"
    )


def format_risk_overview(context):
    focus = focus_employees(context)
    if not focus:
        return "**当前没有识别出高风险或中风险员工。**\n1. 建议继续补充沟通记录\n2. 关注合同、转正、绩效等关键节点"
    lines = []
    for employee in focus[:6]:
        evidence = "、".join(evidence_labels(employee)[:2]) or employee.get("reason") or "证据不足"
        lines.append(f"{len(lines) + 1}. {employee['name']}：{employee.get('level', '待分析')}；{evidence}")
    return "**当前风险员工概览如下。**\n" + "\n".join(lines)


def format_management_actions(message, context):
    focus = focus_employees(context)
    employee = select_employee(message, context) or (focus[0] if focus else None)
    if not employee:
        return "**当前暂无可生成动作的重点对象。**\n1. 先补充员工档案\n2. 记录最近沟通\n3. 再运行风险分析"
    return (
        f"**建议围绕 {employee['name']} 先做三件事。**\n"
        "1. 安排一次 1 对 1 沟通\n"
        "2. 记录风险原因和员工反馈\n"
        "3. 设置后续跟进动作\n"
        f"优先动作：{employee.get('suggestedAction') or '完成状态确认'}"
    )


def select_employee(message, context):
    employees = context.get("employees", [])
    named = next((item for item in employees if item.get("name") and item["name"] in message), None)
    if named:
        return named
    focus = focus_employees(context)
    return focus[0] if focus else None


def evidence_labels(employee):
    if not employee:
        return []
    signals = employee.get("riskSignals") or []
    labels = [
        f"{item.get('label')}：{item.get('value')}"
        if item.get("label") and item.get("value") and item.get("label") != item.get("value")
        else item.get("label") or item.get("value")
        for item in signals
        if item.get("label") or item.get("value")
    ]
    return labels or employee.get("evidence") or employee.get("riskFactors") or []


def local_reply_for_intent(message, context, intent):
    if intent == "greeting":
        return format_greeting_reply(context)
    if intent == "capability_query":
        return format_capability_reply(context)
    if intent == "team_summary":
        return format_team_summary(context)
    if intent == "risk_overview":
        return format_risk_overview(context)
    if intent == "today_priority":
        return format_today_priority(context)
    if intent == "risk_reason":
        return format_risk_reason(message, context)
    if intent in ("management_actions", "create_todo"):
        return format_management_actions(message, context)
    if intent == "communication_outline":
        employee = select_employee(message, context)
        if employee:
            return f"**可以为 {employee['name']} 准备 1 对 1 沟通提纲。**\n1. 先确认风险原因\n2. 听取员工反馈\n3. 明确后续动作"
        return "**可以生成 1 对 1 沟通提纲。**\n请告诉我员工姓名，例如：帮我生成李四的沟通提纲。"
    return fallback_chat_reply(message, context)


def build_reply_card(message, context, intent):
    if intent in ("greeting", "capability_query", "team_summary", "management_advice", "general"):
        return {
            "intent": intent,
            "title": "管理助手问答",
            "conclusion": "小达会根据问题类型决定是否查询员工数据，并给出管理建议。",
            "evidence": [],
            "action": "可以继续追问具体员工、风险原因、今日优先级或管理方法。",
            "employeeKey": "",
            "tone": "low",
        }
    employee = priority_employee(context) if intent == "today_priority" else select_employee(message, context)
    if not employee:
        return {
            "intent": intent,
            "title": "当前暂无明确重点对象",
            "conclusion": "建议先补充员工档案、绩效考勤和沟通记录，再运行风险扫描。",
            "evidence": [],
            "action": "补充基础数据后生成今日待办。",
            "employeeKey": "",
            "tone": "low",
        }
    labels = evidence_labels(employee)[:4]
    level = employee.get("level") or "待分析"
    conclusion = f"建议优先关注{employee['name']}，当前为{level}。"
    if intent == "risk_reason":
        conclusion = f"{employee['name']}的主要风险来自：{'、'.join(labels) if labels else '基础信息不足'}。"
    if intent == "management_actions":
        conclusion = f"建议把{employee['name']}的风险判断落成一个可跟进动作。"
    return {
        "intent": intent,
        "title": "今日优先建议",
        "conclusion": conclusion,
        "evidence": labels,
        "action": employee.get("suggestedAction") or "安排一次 1 对 1 沟通并记录结论。",
        "employeeKey": employee["key"],
        "tone": "high" if level == "高风险" else "medium" if level == "中风险" else "low",
    }


def fallback_chat_reply(message, context):
    if len((message or "").strip()) <= 6:
        return format_greeting_reply(context)
    focus = [employee for employee in context.get("employees", []) if employee.get("level") in ("高风险", "中风险")]
    for employee in context.get("employees", []):
        if employee.get("name") and employee["name"] in message:
            labels = "、".join(evidence_labels(employee)[:3]) or employee.get("reason") or "基础信息不足"
            return (
                f"**结论：{employee['name']}当前为{employee.get('level', '待分析')}。**\n"
                f"1. 依据：{labels}\n"
                f"建议：{employee.get('suggestedAction') or '安排一次状态确认'}。"
            )
    if "优先" in message or "关注" in message:
        if focus:
            top = focus[0]
            evidence = "、".join(evidence_labels(top)[:3]) or top.get("reason") or "基础信息不足"
            names = "、".join(employee["name"] for employee in focus[:3])
            return (
                f"**结论：今天优先关注 {top['name']}。**\n"
                f"1. 当前重点对象包括 {names}\n"
                f"2. {top['name']} 的主要信号是 {evidence}\n"
                "3. 先完成一对一沟通，再推进关键节点待办"
            )
        return (
            "**结论：当前暂无高风险员工。**\n"
            "1. 现有档案未识别出明确高风险对象\n"
            "2. 建议先补充沟通记录\n"
            "3. 对待分析员工运行分析"
        )
    return (
        f"我理解你的问题是想判断下一步怎么管。当前可参考的数据是："
        f"团队 {context.get('summary', {}).get('team_size', 0)} 人，"
        f"{context.get('summary', {}).get('focus_count', 0)} 人需要关注，"
        f"待办 {context.get('summary', {}).get('pending_actions', 0)} 项。\n"
        "你可以把问题再具体一点，比如问“今天先处理谁”或“某位员工为什么有风险”，我会直接给判断和动作。"
    )


def suggest_actions(message, context, intent=None):
    if intent in ("greeting", "capability_query", "management_advice", "general"):
        return []
    employee = priority_employee(context) if intent == "today_priority" else select_employee(message, context)
    if not employee:
        return []
    return [
        {"type": "outline", "label": "生成沟通提纲", "employeeKey": employee["key"]},
        {"type": "todo", "label": "加入待办", "employeeKey": employee["key"]},
        {"type": "profile", "label": "查看员工画像", "employeeKey": employee["key"]},
    ]


def sanitize_reply(text):
    cleaned = (
        (text or "")
        .replace("###", "")
        .replace("##", "")
        .replace("#", "")
        .strip()
    )
    if cleaned.startswith("*") and not cleaned.startswith("**"):
        cleaned = cleaned.lstrip("*").strip()
    if cleaned.endswith("*") and not cleaned.endswith("**"):
        cleaned = cleaned.rstrip("*").strip()
    return cleaned


def build_chat_payload(message, history=None, intent=None):
    resolved_intent = infer_intent(message, intent)
    context = build_chat_context(message, resolved_intent)
    card = build_reply_card(message, context, resolved_intent)
    intent_hint = (
        f"系统初步识别的用户意图：{resolved_intent}。"
        f"本次上下文范围：{context.get('scope', 'unknown')}。"
        "这只是辅助判断，不要机械套模板；请优先理解用户原话并自然回答。"
        "如果 scope 是 agent_capability_only 或 management_knowledge_only，说明本轮没有查询员工数据库；不要声称看到了具体员工数据。"
        "如果 scope 是 matched_employee_records，只基于给出的员工、沟通、待办和风险信号回答。"
        "如果 scope 是 general_no_database_match 且用户问具体员工信息，请先请用户补充姓名或工号。"
        "如果用户只是打招呼或问你能做什么，请像真实助手一样简短回应。"
        "不要输出“我可以基于员工档案...”这类泛泛说明，除非用户明确询问能力。"
    )
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "user", "content": intent_hint + "\n团队上下文：" + json.dumps(chat_context_for_model(context), ensure_ascii=False)},
    ]
    messages.extend((history or [])[-4:])
    messages.append({"role": "user", "content": message})
    return context, resolved_intent, card, messages


def generate_chat_reply(message, history=None, intent=None):
    if not message:
        return {
            "reply": "请输入你想了解的员工、风险或管理动作。",
            "source": "本地智能模板",
            "intent": "empty",
            "card": None,
            "actions": [],
        }

    context, resolved_intent, card, messages = build_chat_payload(message, history, intent)

    try:
        content = client.chat(messages, timeout=12, max_tokens=360, temperature=0.6)
        reply = sanitize_reply(content) if content else "模型暂时没有返回有效内容，请稍后再试。"
        return {
            "reply": reply,
            "source": model_source() if content else "模型未返回",
            "intent": resolved_intent,
            "card": card,
            "actions": suggest_actions(message, context, resolved_intent),
        }
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {
            "reply": "模型连接超时或暂时不可用，请稍后再试。",
            "source": "模型未返回",
            "intent": resolved_intent,
            "card": card,
            "actions": suggest_actions(message, context, resolved_intent),
        }


def generate_chat_reply_stream(message, history=None, intent=None):
    if not message:
        yield {"type": "meta", "source": "本地智能模板", "intent": "empty", "card": None, "actions": []}
        yield {"type": "delta", "text": "请输入你想了解的员工、风险或管理动作。"}
        yield {"type": "done"}
        return

    context, resolved_intent, card, messages = build_chat_payload(message, history, intent)
    actions = suggest_actions(message, context, resolved_intent)
    yield {
        "type": "meta",
        "source": model_source() if client.enabled else "模型未启用",
        "intent": resolved_intent,
        "card": card,
        "actions": actions,
    }

    streamed = False
    try:
        for chunk in client.chat_stream(messages, timeout=18, max_tokens=360, temperature=0.6):
            streamed = True
            yield {"type": "delta", "text": chunk}
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        streamed = False

    if not streamed:
        message_text = "模型暂时没有返回有效内容，请稍后再试。"
        for index in range(0, len(message_text), 8):
            yield {"type": "delta", "text": message_text[index : index + 8]}

    yield {
        "type": "done",
        "source": model_source() if streamed else "模型未返回",
        "intent": resolved_intent,
        "card": card,
        "actions": actions,
    }
