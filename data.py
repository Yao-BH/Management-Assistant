TEAM_CONTEXT = {
    "summary": {
        "team_size": 12,
        "focus_count": 3,
        "pending_actions": 7,
        "communication_coverage": "76%",
    },
    "key_moments": [
        {"employee": "王五", "event": "转正面谈", "due": "本周", "reason": "入职满 3 个月，导师反馈尚未归档"},
        {"employee": "李四", "event": "合同续签评估", "due": "9 天后", "reason": "合同即将到期，近期考勤异常"},
        {"employee": "赵六", "event": "入职周年关怀", "due": "下周", "reason": "建议同步主管并发送关怀提醒"},
    ],
    "employees": [
        {
            "name": "张三",
            "role": "产品运营 · P6",
            "risk": 86,
            "level": "高风险",
            "reason": "连续加班 5 天，绩效从 B+ 下滑到 C，30 天未进行 1 对 1 沟通。",
            "evidence": ["近 7 天加班 28 小时", "Q1 绩效 B+ -> C", "上次沟通距今 30 天"],
            "recommended_action": "今天安排一次绩效与压力沟通",
            "lifecycle": {
                "stage": "成长期",
                "detail": "入职 6-12 个月，当前重点是目标承接、能力成长和稳定沟通节奏。",
            },
        },
        {
            "name": "李四",
            "role": "客户成功 · P6",
            "risk": 67,
            "level": "中风险",
            "reason": "合同节点临近，本月迟到 4 次，需要结合绩效与稳定性完成续签判断。",
            "evidence": ["合同 9 天后到期", "本月迟到 4 次", "近 30 天客户满意度稳定"],
            "recommended_action": "完成合同续签评估",
            "lifecycle": {
                "stage": "稳定期",
                "detail": "任职超过 1 年，当前重点是稳定性判断、续签意愿确认和关键客户交接风险。",
            },
        },
        {
            "name": "王五",
            "role": "前端工程师 · P5",
            "risk": 48,
            "level": "低风险",
            "reason": "入职满 3 个月，尚未安排转正面谈，成长反馈节点临近。",
            "evidence": ["入职 92 天", "导师反馈尚未归档", "试用期目标完成率 82%"],
            "recommended_action": "本周完成转正面谈",
            "lifecycle": {
                "stage": "适应期",
                "detail": "入职 3 个月，处于试用期收口节点，需要完成转正判断和下一阶段成长目标。",
            },
        },
    ],
}


FALLBACK_BRIEF = {
    "title": "今日管理研判",
    "summary": "团队整体稳定，当前有 3 名员工需要管理层关注。今天优先处理张三的绩效与压力沟通，同时将王五转正面谈、李四合同续签评估纳入本周待办，避免关键节点滞后。",
    "insights": [
        {"label": "优先处理", "value": "张三绩效沟通", "detail": "高风险 86，建议今日完成"},
        {"label": "主要风险因子", "value": "加班 + 绩效 + 沟通缺失", "detail": "3 个因子同时触发"},
        {"label": "关键节点", "value": "转正面谈 + 合同续签", "detail": "王五本周转正，李四 9 天后到期"},
    ],
    "source": "本地智能模板",
}


FALLBACK_METRICS = {
    "items": [
        {"key": "team", "label": "员工档案", "value": "12", "detail": "已录入基础信息", "tone": "pink"},
        {"key": "focus", "label": "重点关注", "value": "3", "detail": "系统识别对象", "tone": "blue"},
        {"key": "todo", "label": "待办动作", "value": "7", "detail": "风险与节点生成", "tone": "green"},
        {"key": "coverage", "label": "沟通覆盖", "value": "76%", "detail": "来自沟通记录", "tone": "amber"},
    ],
    "source": "本地统计",
}


FALLBACK_TODOS = {
    "items": [
        {
            "id": "zhangsan",
            "employeeKey": "zhangsan",
            "priority": "P1",
            "title": "张三绩效与压力沟通",
            "badge": "高风险 · 今天",
            "summary": "连续加班 5 天，绩效从 B+ 下滑到 C，30 天未沟通，建议今天完成一次 1 对 1。",
            "tags": ["加班 28h", "绩效 B+ -> C", "30 天未沟通"],
            "level": "high",
        },
        {
            "id": "lisi",
            "employeeKey": "lisi",
            "priority": "P2",
            "title": "李四合同续签评估",
            "badge": "中风险 · 9 天",
            "summary": "合同节点临近，近期考勤异常，需要结合绩效与稳定性完成续签判断。",
            "tags": ["合同 9 天后到期", "本月迟到 4 次", "客户满意度稳定"],
            "level": "medium",
        },
        {
            "id": "wangwu",
            "employeeKey": "wangwu",
            "priority": "P3",
            "title": "王五转正面谈",
            "badge": "关键节点 · 本周",
            "summary": "王五入职满 3 个月，试用期反馈尚未归档，建议本周内完成转正沟通。",
            "tags": ["入职 92 天", "导师反馈待归档", "目标完成率 82%"],
            "level": "low",
        },
    ],
    "source": "本地智能模板",
}


FALLBACK_OUTLINES = {
    "张三": [
        "开场：先认可近期投入，再说明这次沟通希望先理解压力来源，而不是直接评价结果。",
        "重点问题：最近连续加班主要来自任务量、协作阻塞还是目标不清？Q1 绩效下滑你认为最大的影响因素是什么？",
        "建议支持：一起拆解 Q2 目标，明确优先级，必要时协调跨部门资源或调整排期。",
        "行动项：约定两周后复盘；记录需要的资源支持；确认下一次 1 对 1 时间。",
    ],
    "李四": [
        "开场：先确认近期工作状态和续签意愿，再讨论合同节点安排。",
        "重点问题：近期迟到是否由工作安排、通勤或个人状态导致？对当前岗位和团队支持是否满意？",
        "建议支持：同步绩效与客户反馈，明确续签判断依据。",
        "行动项：本周内完成续签评估；记录风险观察点；必要时安排 HRBP 参与。",
    ],
    "王五": [
        "开场：说明转正面谈的目标是复盘试用期表现，并明确下一阶段成长方向。",
        "重点问题：试用期最有成就感的任务是什么？哪些能力还需要团队支持？",
        "建议支持：结合导师反馈确认技能短板，给出 30 天成长计划。",
        "行动项：归档转正结论；确认下一阶段目标；安排导师后续跟进。",
    ],
}


FALLBACK_PROFILES = {
    "张三": {
        "riskSummary": "连续加班 5 天，绩效从 B+ 下滑到 C，30 天未进行 1 对 1 沟通。目标完成率 72%，近期投入较高但结果波动明显，建议先确认压力来源。",
        "evidence": ["近 7 天加班 28 小时", "Q1 绩效 B+ -> C", "上次沟通距今 30 天"],
        "performance": "B+ -> C",
        "attendance": "加班 28h",
        "communication": "30 天未沟通",
        "suggestedAction": "安排 1 对 1",
        "lifecycleStage": "成长期",
        "lifecycleDetail": "入职 6-12 个月，当前重点是目标承接、能力成长和稳定沟通节奏。",
    },
    "李四": {
        "riskSummary": "合同节点临近，本月迟到 4 次，需要结合绩效、稳定性和续签意愿形成判断。",
        "evidence": ["合同 9 天后到期", "本月迟到 4 次", "近 30 天客户满意度稳定"],
        "performance": "客户满意稳定",
        "attendance": "迟到 4 次",
        "communication": "续签待评估",
        "suggestedAction": "完成续签评估",
        "lifecycleStage": "稳定期",
        "lifecycleDetail": "任职超过 1 年，当前重点是稳定性判断、续签意愿确认和关键客户交接风险。",
    },
    "王五": {
        "riskSummary": "入职满 3 个月，尚未安排转正面谈，导师反馈也未归档，需要完成试用期收口。",
        "evidence": ["入职 92 天", "导师反馈待归档", "试用期目标完成率 82%"],
        "performance": "试用期 82%",
        "attendance": "出勤稳定",
        "communication": "转正未面谈",
        "suggestedAction": "完成转正面谈",
        "lifecycleStage": "适应期",
        "lifecycleDetail": "入职 3 个月，处于试用期收口节点，需要完成转正判断和下一阶段成长目标。",
    },
}
