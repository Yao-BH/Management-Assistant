import json
import os
import urllib.request
from pathlib import Path

from env_loader import load_env


load_env(Path(__file__).resolve().parent / ".env")


DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


class DeepSeekClient:
    def __init__(self):
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")
        self.model = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")

    @property
    def enabled(self):
        return bool(self.api_key)

    def chat(self, messages, response_format=None, timeout=30):
        if not self.enabled:
            return None

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if response_format:
            payload["response_format"] = response_format

        request = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))

        return data["choices"][0]["message"]["content"]
