"""Externalized scout source definitions and behavior metadata."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

SCOUT_SOURCE_PATH = Path(__file__).resolve().parents[1] / "data" / "default_scout_sources.json"


@lru_cache(maxsize=1)
def load_scout_source_config() -> dict:
    with SCOUT_SOURCE_PATH.open("r", encoding="utf-8") as config_file:
        return json.load(config_file)


def get_scout_sources() -> list[dict]:
    config = load_scout_source_config()
    layers = config.get("layers", {})
    categories = config.get("categories", {})
    sources = []
    for item in config.get("sources", []):
        source = dict(item)
        source["layer_label"] = layers.get(source.get("layer"), {}).get("label", source.get("layer"))
        source["layer_sort_order"] = layers.get(source.get("layer"), {}).get("sort_order", 99)
        source["category_label"] = categories.get(source.get("category"), {}).get("label", source.get("category"))
        source["total_time"] = sum(step.get("time_minutes", 0) for step in source.get("instructions", []))
        sources.append(source)
    return sources


def get_scout_source(source_id: str) -> Optional[dict]:
    return next((source for source in get_scout_sources() if source["id"] == source_id), None)
