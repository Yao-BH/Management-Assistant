import json
import re


def parse_json_object(content):
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def parse_lines(content):
    content = content.strip()
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict) and isinstance(parsed.get("lines"), list):
            return [str(item).strip() for item in parsed["lines"] if str(item).strip()]
    except json.JSONDecodeError:
        pass

    lines = []
    for line in content.splitlines():
        cleaned = re.sub(r"^\s*[-*\d.、]+\s*", "", line).strip()
        if cleaned:
            lines.append(cleaned)
    return lines[:6]
