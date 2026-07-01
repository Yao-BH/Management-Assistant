import json
import urllib.error

from context_services import build_team_context
from prompts import CHAT_SYSTEM_PROMPT
from service_common import client, model_source


def infer_intent(message, explicit_intent=None):
    if explicit_intent:
        return explicit_intent
    text = message or ""
    if "优先" in text or "先处理" in text or "今天" in text or "关注谁" in text:
        return "today_priority"
    if "为什么" in text or "原因" in text or "风险" in text:
        return "risk_reason"
    if "待办" in text or "动作" in text or "安排" in text or "跟进" in text:
        return "management_actions"
    if "提纲" in text or "沟通" in text or "1 对 1" in text or "一对一" in text:
        return "communication_outline"
    return "general"


def select_employee(message, context):
    named = next((item for item in context["employees"] if item["name"] in message), None)
    if named:
        return named
    focus = [
        item
        for item in context["employees"]
        if item["level"] in ("高风险", "中风险") or item.get("risk", 0) >= 40 or item.get("modelRequired")
    ]
    return sorted(focus, key=lambda item: item.get("risk", 0), reverse=True)[0] if focus else None


def evidence_labels(employee):
    if not employee:
        return []
    signals = employee.get("riskSignals") or []
    labels = [
        f"{item.get('label')}：{item.get('value')}" if item.get("label") and item.get("value") and item.get("label") != item.get("value") else item.get("label") or item.get("value")
        for item in signals
        if item.get("label") or item.get("value")
    ]
    return labels or employee.get("evidence") or employee.get("riskFactors") or []


def build_reply_card(message, context, intent):
    employee = select_employee(message, context)
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
    focus = [employee for employee in context["employees"] if employee["level"] in ("高风险", "中风险")]
    for employee in context["employees"]:
        if employee["name"] in message:
            labels = "、".join(evidence_labels(employee)[:3]) or employee.get("reason") or "基础信息不足"
            return f"{employee['name']}当前为{employee['level']}。主要依据：{labels}。动作：{employee['suggestedAction']}。"
    if "优先" in message or "关注" in message:
        if focus:
            names = "、".join(employee["name"] for employee in focus[:3])
            return f"今天建议优先关注：{names}。动作：先处理最高风险员工的一对一沟通，再推进关键节点待办。"
        return "当前暂无高风险员工。动作：建议先补充沟通记录，并对待分析员工运行 AI 分析。"
    return "我会基于数据库中的员工档案、沟通记录和智能待办回答。你可以问某位员工为什么高风险，或让我生成今日优先级。"


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


def generate_chat_reply(message, history=None, intent=None):
    if not message:
        return {
            "reply": "请输入你想了解的员工、风险或管理动作。",
            "source": "本地智能模板",
            "intent": "empty",
            "card": None,
            "actions": [],
        }

    context = build_team_context()
    resolved_intent = infer_intent(message, intent)
    card = build_reply_card(message, context, resolved_intent)
    intent_hint = f"用户意图：{resolved_intent}。"
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "user", "content": intent_hint + "团队上下文：" + json.dumps(context, ensure_ascii=False)},
    ]
    messages.extend((history or [])[-6:])
    messages.append({"role": "user", "content": message})

    try:
        content = client.chat(messages)
        reply = content.strip() if content else fallback_chat_reply(message, context)
        return {
            "reply": reply,
            "source": model_source() if content else "SQLite 本地分析",
            "intent": resolved_intent,
            "card": card,
            "actions": suggest_actions(message, context),
        }
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return {
            "reply": fallback_chat_reply(message, context),
            "source": "SQLite 本地分析",
            "intent": resolved_intent,
            "card": card,
            "actions": suggest_actions(message, context),
        }
