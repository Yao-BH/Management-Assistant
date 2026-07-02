import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from env_loader import load_env


ROOT = Path(__file__).resolve().parent
load_env(ROOT / ".env")

import database
from agent_services import (
    add_action_todo,
    complete_communication_workflow,
    generate_brief,
    generate_chat_reply,
    generate_communication_summary,
    generate_employee_profile,
    generate_outline,
    generate_todos,
    get_archive,
    get_metrics,
    import_employees,
    remove_employee,
    remove_todo,
    save_communication,
    save_employee,
    update_communication,
    update_todo_status,
)


class Payload(BaseModel):
    employee: dict[str, Any] | None = None
    employees: list[dict[str, Any]] | None = None
    record: dict[str, Any] | None = None
    employeeKey: str | None = None
    message: str | None = None
    history: list[dict[str, Any]] | None = None
    intent: str | None = None
    todoId: str | None = None
    recordId: int | str | None = None
    status: str | None = None


database.init_db()

app = FastAPI(title="员工管理助手 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/archive")
def archive():
    return get_archive()


@app.post("/api/employees")
def employees(payload: Payload):
    return save_employee(payload.employee or {})


@app.post("/api/employees/import")
def employees_import(payload: Payload):
    return import_employees(payload.employees or [])


@app.post("/api/employees/delete")
def employees_delete(payload: Payload):
    try:
        return remove_employee(payload.employeeKey or "")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/communication")
def communication(payload: Payload):
    return save_communication(payload.record or {})


@app.post("/api/communication/update")
def communication_update(payload: Payload):
    try:
        return update_communication(payload.recordId or "", payload.record or {})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/communication/complete")
def communication_complete(payload: Payload):
    return complete_communication_workflow(payload.record or {}, payload.todoId)


@app.post("/api/communication/summary")
def communication_summary(payload: Payload):
    return generate_communication_summary(payload.employeeKey, payload.todoId)


@app.post("/api/brief")
def brief():
    return generate_brief()


@app.post("/api/metrics")
def metrics():
    return get_metrics()


@app.post("/api/todos")
def todos():
    return generate_todos()


@app.post("/api/todos/status")
def todos_status(payload: Payload):
    try:
        return update_todo_status(payload.todoId or "", payload.status or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/todos/delete")
def todos_delete(payload: Payload):
    try:
        return remove_todo(payload.todoId or "")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/profile")
def profile(payload: Payload):
    return generate_employee_profile(payload.employeeKey, payload.employee)


@app.post("/api/analyze")
def analyze(payload: Payload):
    return generate_employee_profile(payload.employeeKey, persist=True)


@app.post("/api/outline")
def outline(payload: Payload):
    return generate_outline(payload.employeeKey, payload.employee)


@app.post("/api/action-todo")
def action_todo(payload: Payload):
    return add_action_todo(payload.employeeKey or "")


@app.post("/api/chat")
def chat(payload: Payload):
    return generate_chat_reply(payload.message or "", payload.history or [], payload.intent)


FRONTEND_DIST = ROOT / "dist"
STATIC_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else ROOT
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


def main():
    import uvicorn

    port = int(os.environ.get("PORT", "8765"))
    print(f"Serving employee agent FastAPI app at http://127.0.0.1:{port}/")
    print("Set DEEPSEEK_API_KEY in .env to enable live model generation.")
    uvicorn.run("server:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
