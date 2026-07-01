import json
import urllib.error

import database
from context_services import get_archive
from prompts import PROFILE_SYSTEM_PROMPT
from risk_engine import infer_level, rule_profile
from service_common import client, model_source, parse_json_object
from todo_services import sync_employee_todo


def fallback_profile_for(employee):
    lifecycle = employee.get("lifecycle") or {}
    if isinstance(lifecycle, str):
        lifecycle = {"stage": lifecycle, "detail": ""}
    signals = employee.get("riskSignals") or []
    signal_labels = [
        f"{item.get('label')}：{item.get('value')}" if item.get("label") and item.get("value") and item.get("label") != item.get("value") else item.get("label") or item.get("value")
        for item in signals
        if item.get("label") or item.get("value")
    ]
    return {
        "riskSummary": employee.get("reason") or "当前员工缺少足够分析数据，建议补充沟通记录、绩效或关键节点。",
        "evidence": signal_labels or employee.get("evidence") or ["基础档案已录入", "等待 AI 分析"],
        "performance": employee.get("performance") or "待分析",
        "attendance": employee.get("attendance") or "待分析",
        "communication": employee.get("communication") or "待分析",
        "suggestedAction": employee.get("suggestedAction") or "补充信息后重新分析",
        "lifecycleStage": lifecycle.get("stage", "待分析"),
        "lifecycleDetail": lifecycle.get("detail", "需要根据入职时间和沟通记录判断生命周期。"),
    }


def infer_risk_score(employee, records):
    if employee.get("risk"):
        return employee["risk"]
    score = 35
    if not records:
        score += 15
    if "待分析" in (employee.get("analysisStatus") or ""):
        score += 8
    return min(score, 80)


def local_profile(employee, records):
    risk = infer_risk_score(employee, records)
    level = infer_level(risk)
    record_hint = f"已有 {len(records)} 条沟通记录" if records else "暂无沟通记录"
    lifecycle = employee.get("lifecycle") or {}
    if isinstance(lifecycle, str):
        lifecycle = {"stage": lifecycle, "detail": ""}
    signals = employee.get("riskSignals") or []
    signal_labels = [
        f"{item.get('label')}：{item.get('value')}" if item.get("label") and item.get("value") and item.get("label") != item.get("value") else item.get("label") or item.get("value")
        for item in signals
        if item.get("label") or item.get("value")
    ]
    return {
        "risk": risk,
        "level": level,
        "riskSummary": employee.get("reason") or f"{employee['name']}当前信息量有限，{record_hint}，建议补充绩效、考勤和近期沟通信息后复核。",
        "evidence": signal_labels or employee.get("evidence") or ["员工基础档案已录入", record_hint],
        "performance": employee.get("performance") or "待分析",
        "attendance": employee.get("attendance") or "待分析",
        "communication": f"{len(records)} 条沟通记录" if records else "暂无沟通记录",
        "suggestedAction": employee.get("suggestedAction") if employee.get("suggestedAction") != "待分析" else "补充沟通记录并安排一次状态确认",
        "lifecycleStage": lifecycle.get("stage", "待分析"),
        "lifecycleDetail": lifecycle.get("detail", "系统将结合入职时间、沟通记录和节点信息判断员工生命周期。"),
        "source": "SQLite 本地分析",
    }


def analyze_changed_employee(employee_key, use_model=True):
    employee = database.get_employee(employee_key)
    if not employee:
        return None
    records = database.list_communication_records()
    profile = rule_profile(employee, records)
    needs_model = use_model and (
        profile["level"] in ("高风险", "中风险")
        or employee.get("modelRequired")
        or employee.get("analysisStatus") in ("待分析", "待模型精算")
    )
    rule_employee = database.save_rule_analysis(employee_key, profile, model_required=needs_model)
    sync_employee_todo(rule_employee)
    if needs_model:
        return generate_employee_profile(employee_key, persist=True)
    return {"employee": database.get_employee(employee_key), "profile": profile, "archive": get_archive()}


def generate_employee_profile(employee_key=None, employee=None, persist=False):
    employee = employee or database.get_employee(employee_key)
    if not employee:
        return {"error": "员工不存在", "source": "系统"}

    records = [
        record
        for record in database.list_communication_records()
        if record["employeeKey"] == employee["key"] or record["employee"] == employee["name"]
    ]
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
        sync_employee_todo(updated)
        return {"employee": updated, "profile": profile, "archive": get_archive()}
    return {**profile, "source": profile.get("source", "SQLite 本地分析")}
