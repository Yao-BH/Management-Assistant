import json
import urllib.error

import database
from prompts import OUTLINE_SYSTEM_PROMPT
from service_common import client, model_source, parse_lines


def fallback_outline_for(employee):
    return [
        f"先确认{employee.get('name', '该员工')}近期状态和主要压力来源。",
        "结合已有沟通记录、绩效表现和关键节点逐项核对。",
        "明确下一步支持动作、负责人和复盘时间。",
    ]


def generate_outline(employee_key=None, employee=None):
    employee = employee or database.get_employee(employee_key)
    if not employee:
        return {"lines": ["请选择一名员工后再生成沟通提纲。"], "source": "本地智能模板"}

    records = [
        record
        for record in database.list_communication_records()
        if record["employeeKey"] == employee["key"] or record["employee"] == employee["name"]
    ]
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
