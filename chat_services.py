import json
import urllib.error

from context_services import build_team_context
from prompts import CHAT_SYSTEM_PROMPT
from service_common import client, model_source


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
