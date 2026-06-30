import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from env_loader import load_env


ROOT = Path(__file__).resolve().parent
load_env(ROOT / ".env")

import database
from agent_services import (
    add_action_todo,
    generate_brief,
    generate_chat_reply,
    generate_employee_profile,
    generate_outline,
    generate_todos,
    get_archive,
    get_metrics,
    import_employees,
    save_communication,
    save_employee,
)


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw or "{}")


def write_json(handler, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(SimpleHTTPRequestHandler):
    routes = {
        "/api/archive": lambda payload: get_archive(),
        "/api/employees": lambda payload: save_employee(payload.get("employee", {})),
        "/api/employees/import": lambda payload: import_employees(payload.get("employees", [])),
        "/api/communication": lambda payload: save_communication(payload.get("record", {})),
        "/api/brief": lambda payload: generate_brief(),
        "/api/metrics": lambda payload: get_metrics(),
        "/api/todos": lambda payload: generate_todos(),
        "/api/profile": lambda payload: generate_employee_profile(payload.get("employeeKey"), payload.get("employee")),
        "/api/analyze": lambda payload: generate_employee_profile(payload.get("employeeKey"), persist=True),
        "/api/outline": lambda payload: generate_outline(payload.get("employeeKey"), payload.get("employee")),
        "/api/action-todo": lambda payload: add_action_todo(payload.get("employeeKey", "")),
        "/api/chat": lambda payload: generate_chat_reply(payload.get("message", ""), payload.get("history", []), payload.get("intent")),
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        route = self.routes.get(self.path)
        if not route:
            self.send_error(404)
            return

        try:
            write_json(self, route(read_json_body(self)))
        except (json.JSONDecodeError, ValueError):
            self.send_error(400, "Invalid JSON")


def main():
    database.init_db()
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving employee agent prototype at http://127.0.0.1:{port}/")
    print("Set DEEPSEEK_API_KEY in .env to enable live model generation.")
    server.serve_forever()


if __name__ == "__main__":
    main()
