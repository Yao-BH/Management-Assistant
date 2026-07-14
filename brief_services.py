import json
import urllib.error

from context_services import build_focus_context
from prompts import BRIEF_SYSTEM_PROMPT
from service_common import client, model_source, parse_json_object
from todo_services import recalculate_risk_state


def local_brief(context):
    summary = context["summary"]
    source = context.get("focus_employees") or context.get("employees") or []
    focus = [employee for employee in source if employee["level"] in ("高风险", "中风险")]
    top = focus[0] if focus else None
    body = (
        f"当前团队共 {summary['team_size']} 人，重点关注 {summary['focus_count']} 人，"
        f"沟通覆盖率 {summary['communication_coverage']}。"
    )
    if top:
        body += f"建议优先处理 {top['name']}：{top['suggestedAction'] or top['reason']}"
    return {
        "title": "今日管理研判",
        "summary": body,
        "insights": [
            {"label": "团队规模", "value": f"{summary['team_size']} 人", "detail": "来自员工档案"},
            {"label": "重点关注", "value": f"{summary['focus_count']} 人", "detail": top["name"] if top else "暂无高风险对象"},
            {"label": "待办动作", "value": f"{summary['pending_actions']} 项", "detail": "来自风险与沟通记录"},
        ],
        "source": "SQLite 本地统计",
    }


def generate_brief():
    recalculate_risk_state()
    context = build_focus_context()
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
        local = local_brief(context)
        return {
            "title": data.get("title") or local["title"],
            "summary": data.get("summary") or local["summary"],
            "insights": (data.get("insights") or local["insights"])[:3],
            "source": model_source(),
        }
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return local_brief(context)
