#!/usr/bin/env python3
"""Generate a stock forecast HTML page from a JSON payload.

Usage:
    python scripts/generate_prediction.py predictions/20260727-2330.json
    python scripts/generate_prediction.py predictions/20260727-2330.json --output public/predictions/20260727-2330.html
"""
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from string import Template
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TEMPLATE = ROOT / "templates" / "prediction_template.html"
REQUIRED_FIELDS = {
    "methodology_version",
    "generated_at",
    "prediction_mode",
    "stock_code",
    "stock_name",
    "forecast_date",
    "base_trade_date",
    "information_cutoff",
    "market",
    "direction_score",
    "raw_direction_label",
    "final_direction_label",
    "data_completeness",
    "missing_data",
    "backtest_rule_id",
    "backtest_status",
}


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def validate(data: dict[str, Any]) -> None:
    missing = sorted(REQUIRED_FIELDS - data.keys())
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    if not isinstance(data.get("direction_score"), (int, float)):
        raise ValueError("direction_score must be numeric")
    completeness = data.get("data_completeness")
    if not isinstance(completeness, (int, float)) or not 0 <= completeness <= 100:
        raise ValueError("data_completeness must be between 0 and 100")


def render_pills(items: list[str]) -> str:
    return "".join(f'<span class="pill">{esc(item)}</span>' for item in items)


def render_cards(items: list[dict[str, Any]], class_name: str = "card") -> str:
    output: list[str] = []
    for item in items:
        output.append(
            f'<article class="{class_name}">'
            f'<span class="label">{esc(item.get("label"))}</span>'
            f'<strong>{esc(item.get("value"))}</strong>'
            f'<p>{esc(item.get("description"))}</p>'
            "</article>"
        )
    return "".join(output)


def render_scores(items: list[dict[str, Any]]) -> str:
    rows: list[str] = []
    for item in items:
        score = item.get("score", 0)
        css = "positive" if score > 0 else "negative" if score < 0 else "neutral"
        rows.append(
            "<tr>"
            f'<td>{esc(item.get("item"))}</td>'
            f'<td>{esc(item.get("value"))}</td>'
            f'<td>{esc(item.get("rule"))}</td>'
            f'<td class="{css}">{esc(score)}</td>'
            "</tr>"
        )
    return "".join(rows)


def render_scenarios(items: list[dict[str, Any]]) -> str:
    return "".join(
        '<article class="scenario">'
        f'<span class="label">{esc(item.get("label"))}</span>'
        f'<h3>{esc(item.get("title"))}</h3>'
        f'<p>{esc(item.get("description"))}</p>'
        f'<strong>{esc(item.get("target"))}</strong>'
        "</article>"
        for item in items
    )


def render_levels(items: list[dict[str, Any]]) -> str:
    return "".join(
        '<div class="level">'
        f'<span>{esc(item.get("type"))}</span>'
        f'<strong>{esc(item.get("price"))}</strong>'
        f'<p>{esc(item.get("description"))}</p>'
        "</div>"
        for item in items
    )


def render_metadata(data: dict[str, Any]) -> str:
    ordered = [
        "methodology_version", "generated_at", "prediction_mode", "stock_code",
        "stock_name", "forecast_date", "base_trade_date", "information_cutoff",
        "market", "direction_score", "raw_direction_label", "risk_score",
        "final_direction_label", "data_completeness", "missing_data",
        "backtest_rule_id", "backtest_status",
    ]
    rows: list[str] = []
    for key in ordered:
        value = data.get(key)
        if isinstance(value, list):
            value = ", ".join(str(item) for item in value) or "none"
        if value is None:
            value = "null"
        rows.append(f"<dt>{esc(key)}</dt><dd><code>{esc(value)}</code></dd>")
    return "".join(rows)


def render(data: dict[str, Any], template_path: Path) -> str:
    validate(data)
    template = Template(template_path.read_text(encoding="utf-8"))
    forecast_date = str(data["forecast_date"])
    stock_name = str(data["stock_name"])
    stock_code = str(data["stock_code"])
    defaults = {
        "meta_description": f"{stock_name}（{stock_code}）{forecast_date} 下一交易日股價風險與情境預測",
        "page_title": f"{forecast_date} {stock_name}（{stock_code}）下一交易日預測報告",
        "lead": "依固定方法規格，以資訊截止時間前可取得的結構化資料評估下一交易日走勢。",
        "hero_pills": [
            f"預測日：{forecast_date}",
            f"基準交易日：{data['base_trade_date']}",
            f"資訊截止：{data['information_cutoff']}",
            f"市場：{data['market']}",
        ],
        "verdict_title": str(data["final_direction_label"]),
        "verdict_summary": "方向標籤由固定分數及風險降級規則產生。",
        "risk_label": str(data.get("risk_label", "風險未標示")),
        "forecast_cards": [],
        "facts": [],
        "scores": [],
        "scenarios": [],
        "levels": [],
        "data_note": "請檢查 missing_data 與 data_completeness 後再解讀結果。",
        "footer": "本頁為規則化市場情境分析，不構成買賣建議。",
    }
    view = {**defaults, **data.get("view", {})}
    return template.substitute(
        meta_description=esc(view["meta_description"]),
        page_title=esc(view["page_title"]),
        forecast_date=esc(forecast_date),
        stock_name=esc(stock_name),
        stock_code=esc(stock_code),
        lead=esc(view["lead"]),
        hero_pills=render_pills(view["hero_pills"]),
        verdict_title=esc(view["verdict_title"]),
        verdict_summary=esc(view["verdict_summary"]),
        final_direction_label=esc(data["final_direction_label"]),
        risk_label=esc(view["risk_label"]),
        forecast_cards=render_cards(view["forecast_cards"]),
        fact_cards=render_cards(view["facts"]),
        score_rows=render_scores(view["scores"]),
        scenario_cards=render_scenarios(view["scenarios"]),
        level_rows=render_levels(view["levels"]),
        data_note=esc(view["data_note"]),
        metadata_rows=render_metadata(data),
        footer=esc(view["footer"]),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a forecast HTML page")
    parser.add_argument("input", type=Path, help="forecast JSON payload")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        data = json.loads(args.input.read_text(encoding="utf-8"))
        output = args.output or ROOT / "public" / "predictions" / (
            f"{str(data['forecast_date']).replace('-', '')}-{data['stock_code']}.html"
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(render(data, args.template), encoding="utf-8")
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as exc:
        parser.error(str(exc))
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
