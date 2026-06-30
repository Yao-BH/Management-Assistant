import json
import sqlite3
from datetime import date
from pathlib import Path

from data import FALLBACK_PROFILES, FALLBACK_TODOS, TEAM_CONTEXT


DB_PATH = Path(__file__).resolve().parent / "employee_agent.db"


def connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS employees (
                key TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                employee_id TEXT,
                department TEXT,
                role TEXT,
                hire_date TEXT,
                manager TEXT,
                risk INTEGER DEFAULT 0,
                level TEXT DEFAULT '待分析',
                reason TEXT DEFAULT '',
                evidence_json TEXT DEFAULT '[]',
                goal TEXT DEFAULT '',
                lifecycle_stage TEXT DEFAULT '待分析',
                lifecycle_detail TEXT DEFAULT '',
                performance TEXT DEFAULT '待分析',
                attendance TEXT DEFAULT '待分析',
                communication TEXT DEFAULT '待分析',
                suggested_action TEXT DEFAULT '待分析',
                analysis_status TEXT DEFAULT '待分析',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS communication_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_key TEXT,
                employee_name TEXT NOT NULL,
                date TEXT NOT NULL,
                type TEXT,
                summary TEXT,
                action TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS todos (
                id TEXT PRIMARY KEY,
                employee_key TEXT,
                priority TEXT,
                title TEXT NOT NULL,
                badge TEXT,
                summary TEXT,
                tags_json TEXT DEFAULT '[]',
                level TEXT DEFAULT 'medium',
                status TEXT DEFAULT '待处理',
                source TEXT DEFAULT 'system',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        if not db.execute("SELECT 1 FROM employees LIMIT 1").fetchone():
            seed_defaults(db)


def seed_defaults(db):
    for employee in TEAM_CONTEXT["employees"]:
        profile = FALLBACK_PROFILES.get(employee["name"], {})
        key = slugify_name(employee["name"])
        lifecycle = employee.get("lifecycle", {})
        db.execute(
            """
            INSERT INTO employees (
                key, name, employee_id, department, role, hire_date, manager,
                risk, level, reason, evidence_json, goal, lifecycle_stage,
                lifecycle_detail, performance, attendance, communication,
                suggested_action, analysis_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                key,
                employee["name"],
                default_employee_id(key),
                default_department(employee["role"]),
                employee["role"],
                default_hire_date(employee["name"]),
                "姚老师",
                employee.get("risk", 0),
                employee.get("level", "待分析"),
                employee.get("reason", ""),
                json.dumps(employee.get("evidence", []), ensure_ascii=False),
                employee.get("recommended_action", ""),
                lifecycle.get("stage", profile.get("lifecycleStage", "待分析")),
                lifecycle.get("detail", profile.get("lifecycleDetail", "")),
                profile.get("performance", "待分析"),
                profile.get("attendance", "待分析"),
                profile.get("communication", "待分析"),
                profile.get("suggestedAction", employee.get("recommended_action", "待分析")),
                "已分析",
            ),
        )

    db.executemany(
        """
        INSERT INTO communication_records (employee_key, employee_name, date, type, summary, action)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("zhangsan", "张三", "2026-06-29", "1 对 1", "近期连续加班，需确认压力来源和目标优先级。", "今天完成绩效与压力沟通"),
            ("lisi", "李四", "2026-06-28", "合同续签", "合同 9 天后到期，需结合考勤和续签意愿评估。", "本周完成续签评估"),
        ],
    )

    for item in FALLBACK_TODOS["items"]:
        upsert_todo(db, item)


def slugify_name(name):
    mapping = {"张三": "zhangsan", "李四": "lisi", "王五": "wangwu"}
    return mapping.get(name, str(name).strip().lower().replace(" ", "-") or f"employee-{date.today().isoformat()}")


def default_employee_id(key):
    return {"zhangsan": "E2024001", "lisi": "E2023018", "wangwu": "E2026007"}.get(key, "")


def default_department(role):
    if "工程师" in role:
        return "研发部"
    if "客户" in role:
        return "客户成功部"
    return "产品部"


def default_hire_date(name):
    return {"张三": "2025-08-12", "李四": "2023-05-20", "王五": "2026-03-28"}.get(name, "")


def row_to_employee(row):
    return {
        "key": row["key"],
        "name": row["name"],
        "employeeId": row["employee_id"] or "",
        "department": row["department"] or "",
        "role": row["role"] or "",
        "hireDate": row["hire_date"] or "",
        "manager": row["manager"] or "",
        "risk": row["risk"] or 0,
        "level": row["level"] or "待分析",
        "reason": row["reason"] or "",
        "evidence": json.loads(row["evidence_json"] or "[]"),
        "goal": row["goal"] or "",
        "lifecycle": {
            "stage": row["lifecycle_stage"] or "待分析",
            "detail": row["lifecycle_detail"] or "",
        },
        "performance": row["performance"] or "待分析",
        "attendance": row["attendance"] or "待分析",
        "communication": row["communication"] or "待分析",
        "suggestedAction": row["suggested_action"] or "待分析",
        "analysisStatus": row["analysis_status"] or "待分析",
    }


def row_to_record(row):
    return {
        "id": row["id"],
        "employeeKey": row["employee_key"] or "",
        "employee": row["employee_name"] or "",
        "date": row["date"] or "",
        "type": row["type"] or "",
        "summary": row["summary"] or "",
        "action": row["action"] or "",
    }


def row_to_todo(row):
    return {
        "id": row["id"],
        "employeeKey": row["employee_key"] or "",
        "priority": row["priority"] or "",
        "title": row["title"] or "",
        "badge": row["badge"] or "",
        "summary": row["summary"] or "",
        "tags": json.loads(row["tags_json"] or "[]"),
        "level": row["level"] or "medium",
        "status": row["status"] or "待处理",
    }


def list_employees():
    with connect() as db:
        rows = db.execute("SELECT * FROM employees ORDER BY updated_at DESC, name").fetchall()
        return [row_to_employee(row) for row in rows]


def get_employee(key):
    with connect() as db:
        row = db.execute("SELECT * FROM employees WHERE key = ?", (key,)).fetchone()
        return row_to_employee(row) if row else None


def get_employee_by_name(name):
    with connect() as db:
        row = db.execute("SELECT * FROM employees WHERE name = ?", (name,)).fetchone()
        return row_to_employee(row) if row else None


def upsert_employee(employee):
    key = employee.get("key") or slugify_name(employee.get("name", ""))
    lifecycle = employee.get("lifecycle") or {}
    if isinstance(lifecycle, str):
        lifecycle = {"stage": lifecycle, "detail": employee.get("lifecycleDetail", "")}
    with connect() as db:
        db.execute(
            """
            INSERT INTO employees (
                key, name, employee_id, department, role, hire_date, manager,
                risk, level, reason, evidence_json, goal, lifecycle_stage,
                lifecycle_detail, performance, attendance, communication,
                suggested_action, analysis_status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                name=excluded.name,
                employee_id=excluded.employee_id,
                department=excluded.department,
                role=excluded.role,
                hire_date=excluded.hire_date,
                manager=excluded.manager,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                key,
                employee.get("name", ""),
                employee.get("employeeId", ""),
                employee.get("department", ""),
                employee.get("role", ""),
                employee.get("hireDate", ""),
                employee.get("manager", ""),
                employee.get("risk", 0),
                employee.get("level", "待分析"),
                employee.get("reason", ""),
                json.dumps(employee.get("evidence", []), ensure_ascii=False),
                employee.get("goal", ""),
                lifecycle.get("stage", employee.get("lifecycleStage", "待分析")),
                lifecycle.get("detail", employee.get("lifecycleDetail", "")),
                employee.get("performance", "待分析"),
                employee.get("attendance", "待分析"),
                employee.get("communication", "待分析"),
                employee.get("suggestedAction", "待分析"),
                employee.get("analysisStatus", "待分析"),
            ),
        )
    return get_employee(key)


def save_analysis(employee_key, profile):
    with connect() as db:
        db.execute(
            """
            UPDATE employees SET
                risk = ?,
                level = ?,
                reason = ?,
                evidence_json = ?,
                goal = ?,
                lifecycle_stage = ?,
                lifecycle_detail = ?,
                performance = ?,
                attendance = ?,
                communication = ?,
                suggested_action = ?,
                analysis_status = '已分析',
                updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
            """,
            (
                profile.get("risk", 50),
                profile.get("level", "中风险"),
                profile.get("riskSummary", ""),
                json.dumps(profile.get("evidence", []), ensure_ascii=False),
                profile.get("suggestedAction", ""),
                profile.get("lifecycleStage", "待分析"),
                profile.get("lifecycleDetail", ""),
                profile.get("performance", "待分析"),
                profile.get("attendance", "待分析"),
                profile.get("communication", "待分析"),
                profile.get("suggestedAction", "待分析"),
                employee_key,
            ),
        )
    return get_employee(employee_key)


def list_communication_records():
    with connect() as db:
        rows = db.execute("SELECT * FROM communication_records ORDER BY date DESC, id DESC").fetchall()
        return [row_to_record(row) for row in rows]


def add_communication_record(record):
    employee_key = record.get("employeeKey", "")
    employee_name = record.get("employee") or record.get("employeeName", "")
    if not employee_key and employee_name:
        employee = get_employee_by_name(employee_name)
        employee_key = employee["key"] if employee else ""
    with connect() as db:
        cursor = db.execute(
            """
            INSERT INTO communication_records (employee_key, employee_name, date, type, summary, action)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                employee_key,
                employee_name,
                record.get("date") or date.today().isoformat(),
                record.get("type", ""),
                record.get("summary", ""),
                record.get("action", ""),
            ),
        )
        row = db.execute("SELECT * FROM communication_records WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return row_to_record(row)


def list_todos():
    with connect() as db:
        rows = db.execute(
            """
            SELECT * FROM todos
            ORDER BY
                CASE status
                    WHEN '待处理' THEN 0
                    WHEN '处理中' THEN 1
                    WHEN '已完成' THEN 2
                    WHEN '已忽略' THEN 3
                    ELSE 4
                END,
                priority,
                created_at DESC
            """
        ).fetchall()
        return [row_to_todo(row) for row in rows]


def get_todo(todo_id):
    with connect() as db:
        row = db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        return row_to_todo(row) if row else None


def upsert_todo(db, item):
    db.execute(
        """
        INSERT INTO todos (id, employee_key, priority, title, badge, summary, tags_json, level, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            employee_key=excluded.employee_key,
            priority=excluded.priority,
            title=excluded.title,
            badge=excluded.badge,
            summary=excluded.summary,
            tags_json=excluded.tags_json,
            level=excluded.level,
            status=excluded.status,
            source=excluded.source
        """,
        (
            item.get("id"),
            item.get("employeeKey", ""),
            item.get("priority", ""),
            item.get("title", ""),
            item.get("badge", ""),
            item.get("summary", ""),
            json.dumps(item.get("tags", []), ensure_ascii=False),
            item.get("level", "medium"),
            item.get("status", "待处理"),
            item.get("source", "system"),
        ),
    )


def replace_todos(items):
    with connect() as db:
        db.execute("DELETE FROM todos WHERE source = 'ai'")
        for index, item in enumerate(items, start=1):
            item = {**item, "id": item.get("id") or f"ai-{index}", "source": "ai"}
            upsert_todo(db, item)
    return list_todos()


def add_todo(item):
    with connect() as db:
        item = {**item, "id": item.get("id") or f"manual-{date.today().isoformat()}-{item.get('employeeKey', 'todo')}", "source": "manual"}
        upsert_todo(db, item)
    return list_todos()


def update_todo_status(todo_id, status):
    with connect() as db:
        db.execute("UPDATE todos SET status = ? WHERE id = ?", (status, todo_id))
    return get_todo(todo_id)


def complete_employee_todos(employee_key):
    with connect() as db:
        db.execute(
            """
            UPDATE todos
            SET status = '已完成'
            WHERE employee_key = ? AND status NOT IN ('已完成', '已忽略')
            """,
            (employee_key,),
        )
    return list_todos()
