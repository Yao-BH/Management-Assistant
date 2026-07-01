import json
import urllib.error

from llm_client import DeepSeekClient
from text_utils import parse_json_object, parse_lines


client = DeepSeekClient()


def model_source():
    return f"DeepSeek ({client.model})"
