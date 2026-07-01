from datetime import date, datetime

import database


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def days_until(value):
    target = parse_date(value)
    if not target:
        return None
    return (target - date.today()).days


def days_since(value):
    target = parse_date(value)
    if not target:
        return None
    return (date.today() - target).days


def lifecycle_for(employee):
    hire_days = days_since(employee.get("hireDate"))
    if hire_days is None:
        return {"stage": "待分析", "detail": "缺少入职日期，暂无法判断员工生命周期。"}
    if hire_days < 90:
        return {"stage": "入职期", "detail": "入职 0-3 个月，重点关注融入、导师带教和基础目标承接。"}
    if hire_days < 180:
        return {"stage": "适应期", "detail": "入职 3-6 个月，重点关注试用期收口、反馈频率和能力补齐。"}
    if hire_days < 365:
        return {"stage": "成长期", "detail": "入职 6-12 个月，重点关注目标承接、能力成长和稳定沟通节奏。"}
    if hire_days < 365 * 3:
        return {"stage": "稳定期", "detail": "任职 1-3 年，重点关注稳定性、成长空间和关键项目投入。"}
    if hire_days < 365 * 5:
        return {"stage": "成熟期", "detail": "任职 3-5 年，重点关注影响力、晋升机会和长期激励。"}
    return {"stage": "关键期", "detail": "任职 5 年以上或进入关键风险期，重点关注发展瓶颈和保留动作。"}


def latest_record_for(employee, records):
    related = [record for record in records if record["employeeKey"] == employee["key"] or record["employee"] == employee["name"]]
    return related[0] if related else None


def infer_level(score):
    if score >= 75:
        return "高风险"
    if score >= 55:
        return "中风险"
    return "低风险"


def signal(label, value, score_delta, severity="medium", signal_type=None, source_ref_type="employee_field"):
    return {
        "type": signal_type or label,
        "label": label,
        "value": str(value),
        "scoreDelta": score_delta,
        "severity": severity,
        "confidence": 100,
        "source": "rule",
        "sourceRefType": source_ref_type,
        "sourceRefId": "",
    }


def rule_profile(employee, records=None):
    records = records if records is not None else database.list_communication_records()
    latest_record = latest_record_for(employee, records)
    lifecycle = lifecycle_for(employee)
    risk = 0
    factors = []
    evidence = []
    signals = []

    trend = employee.get("performanceTrend")
    if trend in ("明显下滑", "连续下滑"):
        risk += 25
        item = signal("绩效下滑", f"绩效趋势：{trend}", 25, "high", "performance_drop")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)
    elif trend == "轻微下滑":
        risk += 12
        item = signal("绩效波动", "绩效趋势：轻微下滑", 12, "medium", "performance_drop")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    goal_rate = int(employee.get("goalCompletionRate") or 0)
    if goal_rate and goal_rate < 70:
        risk += 15
        item = signal("目标完成率偏低", f"目标完成率 {goal_rate}%", 15, "medium", "goal_gap")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    last_gap = days_since(latest_record["date"]) if latest_record else None
    if last_gap is None:
        risk += 18
        item = signal("沟通缺失", "暂无沟通记录", 18, "high", "communication_gap", "communication_record")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)
    elif last_gap >= 30:
        risk += 18
        item = signal("30 天未沟通", f"距上次沟通 {last_gap} 天", 18, "high", "communication_gap", "communication_record")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    overtime = float(employee.get("overtimeHours30d") or 0)
    late_count = int(employee.get("lateCount30d") or 0)
    leave_days = float(employee.get("leaveDays30d") or 0)
    if overtime >= 30:
        risk += 15
        item = signal("加班偏高", f"近 30 天加班 {overtime:g} 小时", 15, "medium", "overtime")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)
    if late_count >= 4:
        risk += 10
        item = signal("考勤异常", f"近 30 天迟到 {late_count} 次", 10, "medium", "attendance_issue")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)
    if leave_days >= 5:
        risk += 8
        item = signal("请假偏多", f"近 30 天请假 {leave_days:g} 天", 8, "low", "leave_high")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    contract_days = days_until(employee.get("contractEndDate"))
    if contract_days is not None and 0 <= contract_days <= 30:
        risk += 12
        item = signal("合同临期", f"合同 {contract_days} 天后到期", 12, "medium", "contract_due")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    probation_days = days_until(employee.get("probationEndDate"))
    if probation_days is not None and 0 <= probation_days <= 14:
        risk += 10
        item = signal("转正节点", f"转正节点 {probation_days} 天后到期", 10, "medium", "probation_due")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    if employee.get("compensationSignal") in ("不满", "强烈不满", "外部机会"):
        risk += 18
        item = signal("薪酬/机会风险", f"薪酬信号：{employee['compensationSignal']}", 18, "high", "compensation_risk")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    if employee.get("growthSummary") in ("停滞", "缺少成长", "晋升受阻"):
        risk += 10
        item = signal("成长停滞", f"成长信息：{employee['growthSummary']}", 10, "medium", "growth_stagnation")
        factors.append(item["label"])
        evidence.append(item["value"])
        signals.append(item)

    risk = min(risk, 100)
    level = infer_level(risk)
    if risk < 40:
        level = "正常"
    action = "优先安排 1 对 1 沟通并形成跟进行动" if level in ("高风险", "中风险") else "安排一次状态确认并补充关键节点信息" if risk >= 40 else "保持常规沟通节奏"
    return {
        "risk": risk,
        "level": level,
        "riskSummary": "；".join(evidence) if evidence else "规则扫描未发现明显风险信号。",
        "evidence": evidence or ["规则扫描通过"],
        "riskFactors": factors,
        "riskSignals": signals,
        "performance": employee.get("performanceRating") or employee.get("performance") or "待分析",
        "attendance": f"加班{overtime:g}h / 迟到{late_count}次 / 请假{leave_days:g}天",
        "communication": f"距上次沟通 {last_gap} 天" if last_gap is not None else "暂无沟通记录",
        "suggestedAction": action,
        "lifecycleStage": lifecycle["stage"],
        "lifecycleDetail": lifecycle["detail"],
        "source": "规则引擎",
    }
