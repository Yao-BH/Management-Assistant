import json
import sqlite3
from datetime import date
from pathlib import Path


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
                job_level TEXT,
                hire_date TEXT,
                manager TEXT,
                performance_rating TEXT DEFAULT '',
                performance_trend TEXT DEFAULT '',
                goal_completion_rate INTEGER DEFAULT 0,
                overtime_hours_30d REAL DEFAULT 0,
                late_count_30d INTEGER DEFAULT 0,
                leave_days_30d REAL DEFAULT 0,
                contract_end_date TEXT DEFAULT '',
                probation_end_date TEXT DEFAULT '',
                mentor TEXT DEFAULT '',
                growth_summary TEXT DEFAULT '',
                awards_summary TEXT DEFAULT '',
                key_events TEXT DEFAULT '',
                compensation_signal TEXT DEFAULT '',
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
                data_version INTEGER DEFAULT 0,
                last_analyzed_at TEXT,
                risk_factors_json TEXT DEFAULT '[]',
                model_required INTEGER DEFAULT 0,
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
        ensure_employee_columns(db)


def ensure_employee_columns(db):
    columns = {row["name"] for row in db.execute("PRAGMA table_info(employees)").fetchall()}
    migrations = {
        "job_level": "ALTER TABLE employees ADD COLUMN job_level TEXT DEFAULT ''",
        "performance_rating": "ALTER TABLE employees ADD COLUMN performance_rating TEXT DEFAULT ''",
        "performance_trend": "ALTER TABLE employees ADD COLUMN performance_trend TEXT DEFAULT ''",
        "goal_completion_rate": "ALTER TABLE employees ADD COLUMN goal_completion_rate INTEGER DEFAULT 0",
        "overtime_hours_30d": "ALTER TABLE employees ADD COLUMN overtime_hours_30d REAL DEFAULT 0",
        "late_count_30d": "ALTER TABLE employees ADD COLUMN late_count_30d INTEGER DEFAULT 0",
        "leave_days_30d": "ALTER TABLE employees ADD COLUMN leave_days_30d REAL DEFAULT 0",
        "contract_end_date": "ALTER TABLE employees ADD COLUMN contract_end_date TEXT DEFAULT ''",
        "probation_end_date": "ALTER TABLE employees ADD COLUMN probation_end_date TEXT DEFAULT ''",
        "mentor": "ALTER TABLE employees ADD COLUMN mentor TEXT DEFAULT ''",
        "growth_summary": "ALTER TABLE employees ADD COLUMN growth_summary TEXT DEFAULT ''",
        "awards_summary": "ALTER TABLE employees ADD COLUMN awards_summary TEXT DEFAULT ''",
        "key_events": "ALTER TABLE employees ADD COLUMN key_events TEXT DEFAULT ''",
        "compensation_signal": "ALTER TABLE employees ADD COLUMN compensation_signal TEXT DEFAULT ''",
        "data_version": "ALTER TABLE employees ADD COLUMN data_version INTEGER DEFAULT 0",
        "last_analyzed_at": "ALTER TABLE employees ADD COLUMN last_analyzed_at TEXT",
        "risk_factors_json": "ALTER TABLE employees ADD COLUMN risk_factors_json TEXT DEFAULT '[]'",
        "model_required": "ALTER TABLE employees ADD COLUMN model_required INTEGER DEFAULT 0",
    }
    for column, sql in migrations.items():
        if column not in columns:
            db.execute(sql)


def slugify_name(name):
    mapping = {"张三": "zhangsan", "李四": "lisi", "王五": "wangwu"}
    return mapping.get(name, str(name).strip().lower().replace(" ", "-") or f"employee-{date.today().isoformat()}")


def row_to_employee(row):
    return {
        "key": row["key"],
        "name": row["name"],
        "employeeId": row["employee_id"] or "",
        "department": row["department"] or "",
        "role": row["role"] or "",
        "jobLevel": row["job_level"] or "",
        "hireDate": row["hire_date"] or "",
        "manager": row["manager"] or "",
        "performanceRating": row["performance_rating"] or "",
        "performanceTrend": row["performance_trend"] or "",
        "goalCompletionRate": row["goal_completion_rate"] or 0,
        "overtimeHours30d": row["overtime_hours_30d"] or 0,
        "lateCount30d": row["late_count_30d"] or 0,
        "leaveDays30d": row["leave_days_30d"] or 0,
        "contractEndDate": row["contract_end_date"] or "",
        "probationEndDate": row["probation_end_date"] or "",
        "mentor": row["mentor"] or "",
        "growthSummary": row["growth_summary"] or "",
        "awardsSummary": row["awards_summary"] or "",
        "keyEvents": row["key_events"] or "",
        "compensationSignal": row["compensation_signal"] or "",
        "risk": row["risk"] or 0,
        "level": row["level"] or "待分析",
        "reason": row["reason"] or "",
        "evidence": json.loads(row["evidence_json"] or "[]"),
        "riskFactors": json.loads(row["risk_factors_json"] or "[]"),
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
        "dataVersion": row["data_version"] or 0,
        "lastAnalyzedAt": row["last_analyzed_at"] or "",
        "modelRequired": bool(row["model_required"]),
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


def get_employee_by_id(employee_id):
    if not employee_id:
        return None
    with connect() as db:
        row = db.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
        return row_to_employee(row) if row else None


def delete_employee(employee_key):
    with connect() as db:
        row = db.execute("SELECT * FROM employees WHERE key = ?", (employee_key,)).fetchone()
        if not row:
            return None
        employee = row_to_employee(row)
        db.execute("DELETE FROM todos WHERE employee_key = ?", (employee_key,))
        db.execute("DELETE FROM communication_records WHERE employee_key = ?", (employee_key,))
        db.execute("DELETE FROM employees WHERE key = ?", (employee_key,))
        return employee


def upsert_employee(employee):
    employee_id = employee.get("employeeId", "")
    existing = None if employee.get("key") else get_employee_by_id(employee_id)
    key = employee.get("key") or (existing["key"] if existing else slugify_name(employee.get("name", "")))
    lifecycle = employee.get("lifecycle") or {}
    if isinstance(lifecycle, str):
        lifecycle = {"stage": lifecycle, "detail": employee.get("lifecycleDetail", "")}
    with connect() as db:
        db.execute(
            """
            INSERT INTO employees (
                key, name, employee_id, department, role, job_level, hire_date, manager,
                performance_rating, performance_trend, goal_completion_rate,
                overtime_hours_30d, late_count_30d, leave_days_30d,
                contract_end_date, probation_end_date, mentor, growth_summary,
                awards_summary, key_events, compensation_signal,
                risk, level, reason, evidence_json, goal, lifecycle_stage,
                lifecycle_detail, performance, attendance, communication,
                suggested_action, analysis_status, data_version, model_required, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                name=excluded.name,
                employee_id=excluded.employee_id,
                department=excluded.department,
                role=excluded.role,
                job_level=excluded.job_level,
                hire_date=excluded.hire_date,
                manager=excluded.manager,
                performance_rating=excluded.performance_rating,
                performance_trend=excluded.performance_trend,
                goal_completion_rate=excluded.goal_completion_rate,
                overtime_hours_30d=excluded.overtime_hours_30d,
                late_count_30d=excluded.late_count_30d,
                leave_days_30d=excluded.leave_days_30d,
                contract_end_date=excluded.contract_end_date,
                probation_end_date=excluded.probation_end_date,
                mentor=excluded.mentor,
                growth_summary=excluded.growth_summary,
                awards_summary=excluded.awards_summary,
                key_events=excluded.key_events,
                compensation_signal=excluded.compensation_signal,
                analysis_status='待分析',
                data_version=employees.data_version + 1,
                model_required=1,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                key,
                employee.get("name", ""),
                employee.get("employeeId", ""),
                employee.get("department", ""),
                employee.get("role", ""),
                employee.get("jobLevel", ""),
                employee.get("hireDate", ""),
                employee.get("manager", ""),
                employee.get("performanceRating", ""),
                employee.get("performanceTrend", ""),
                int(employee.get("goalCompletionRate") or 0),
                float(employee.get("overtimeHours30d") or 0),
                int(employee.get("lateCount30d") or 0),
                float(employee.get("leaveDays30d") or 0),
                employee.get("contractEndDate", ""),
                employee.get("probationEndDate", ""),
                employee.get("mentor", ""),
                employee.get("growthSummary", ""),
                employee.get("awardsSummary", ""),
                employee.get("keyEvents", ""),
                employee.get("compensationSignal", ""),
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
                int(employee.get("dataVersion") or 0),
                int(bool(employee.get("modelRequired", True))),
            ),
        )
    return get_employee(key)


def save_rule_analysis(employee_key, profile, model_required=True):
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
                analysis_status = ?,
                risk_factors_json = ?,
                model_required = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
            """,
            (
                profile.get("risk", 0),
                profile.get("level", "正常"),
                profile.get("riskSummary", ""),
                json.dumps(profile.get("evidence", []), ensure_ascii=False),
                profile.get("suggestedAction", ""),
                profile.get("lifecycleStage", "待分析"),
                profile.get("lifecycleDetail", ""),
                profile.get("performance", "待分析"),
                profile.get("attendance", "待分析"),
                profile.get("communication", "待分析"),
                profile.get("suggestedAction", "待分析"),
                "待模型精算" if model_required else "规则已分析",
                json.dumps(profile.get("riskFactors", []), ensure_ascii=False),
                int(bool(model_required)),
                employee_key,
            ),
        )
    return get_employee(employee_key)


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
                last_analyzed_at = CURRENT_TIMESTAMP,
                model_required = 0,
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


def update_communication_record(record_id, updates):
    current_records = list_communication_records()
    current = next((record for record in current_records if str(record["id"]) == str(record_id)), None)
    if not current:
        return None

    employee_name = updates.get("employee", current["employee"])
    employee_key = updates.get("employeeKey", current["employeeKey"])
    if employee_name and (not employee_key or employee_name != current["employee"]):
        employee = get_employee_by_name(employee_name)
        employee_key = employee["key"] if employee else employee_key

    with connect() as db:
        db.execute(
            """
            UPDATE communication_records SET
                employee_key = ?,
                employee_name = ?,
                date = ?,
                type = ?,
                summary = ?,
                action = ?
            WHERE id = ?
            """,
            (
                employee_key or "",
                employee_name or "",
                updates.get("date", current["date"]),
                updates.get("type", current["type"]),
                updates.get("summary", current["summary"]),
                updates.get("action", current["action"]),
                record_id,
            ),
        )
        row = db.execute("SELECT * FROM communication_records WHERE id = ?", (record_id,)).fetchone()
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


def delete_todo(todo_id):
    with connect() as db:
        row = db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if not row:
            return None
        todo = row_to_todo(row)
        db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        return todo


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
