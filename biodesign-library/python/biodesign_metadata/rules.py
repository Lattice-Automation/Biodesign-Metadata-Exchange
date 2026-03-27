"""
Rule checking for evaluating metadata revisions.
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

def _count_nucleotides_in_text(text: str) -> int:
    """Count nucleotides (atgcnATCGN) in a text string."""
    if not text:
        return 0
    matches = re.findall(r"[atgcnATCGN]", text)
    return len(matches)


def _count_added_nucleotides_from_diff(diff: str) -> int:
    """Count nucleotides added in a diff string (diff_match_patch format)."""
    if not diff:
        return 0
    added_count = 0
    for line in diff.split("\n"):
        if line.startswith("+") and not line.startswith("@@") and len(line) > 1:
            added_count += _count_nucleotides_in_text(line[1:])
    return added_count


def count_added_nucleotides(revision: Dict[str, Any]) -> int:
    """Count nucleotides added for a specific revision."""
    op_details = revision.get("operationDetails") or {}
    op_code = revision.get("operationCode", "")

    if op_code == "PASTE" and "pasted_text" in op_details:
        pasted = op_details["pasted_text"]
        if isinstance(pasted, list):
            return sum(_count_nucleotides_in_text(t) for t in pasted)
        if isinstance(pasted, str):
            return _count_nucleotides_in_text(pasted)

    if op_code == "INSERT" and "insert_sequence" in op_details:
        return _count_nucleotides_in_text(str(op_details["insert_sequence"]))

    if op_code == "APPEND" and "appended_sequence" in op_details:
        return _count_nucleotides_in_text(str(op_details["appended_sequence"]))

    return _count_added_nucleotides_from_diff(revision.get("change") or "")


def _parse_ts(ts: str):
    """Parse timestamp; supports ISO and MM/DD/YYYY, HH:MM:SS formats."""
    from datetime import datetime

    if not ts:
        return None
    ts = ts.strip()
    for fmt in ("%m/%d/%Y, %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(ts.replace("Z", "").replace("+00:00", "").strip(), fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _time_gap_days(timestamp1: str, timestamp2: str) -> float:
    """Calculate time gap in days between two timestamps."""
    d1, d2 = _parse_ts(timestamp1), _parse_ts(timestamp2)
    if d1 is None or d2 is None:
        return 0.0
    return abs((d2 - d1).total_seconds()) / (24 * 3600)


def _time_gap_seconds(timestamp1: str, timestamp2: str) -> float:
    """Calculate time gap in seconds between two timestamps."""
    d1, d2 = _parse_ts(timestamp1), _parse_ts(timestamp2)
    if d1 is None or d2 is None:
        return 0.0
    return abs((d2 - d1).total_seconds())


def check_rules_for_revision(
    revision: Dict[str, Any],
    rules: List[Dict[str, Any]],
    previous_revision: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Check if a revision matches any enabled rule.
    Returns dict with: status, matched_rule_id, auto_screening_recommended.
    Status is 'flagged' when a rule matches, else 'default'.
    """
    enabled_rules = [r for r in rules if r.get("enabled", False)]
    if not enabled_rules:
        return {"status": "default", "matched_rule_id": None, "auto_screening_recommended": False}

    existing_status = revision.get("status") or "default"
    if existing_status in ("marked_safe", "marked_unsafe"):
        return {"status": existing_status, "matched_rule_id": None, "auto_screening_recommended": False}

    for rule in enabled_rules:
        rule_type = rule.get("type", "")
        matches = False

        if rule_type == "nucleotides_added":
            threshold = rule.get("threshold", 0)
            added = count_added_nucleotides(revision)
            matches = added > threshold

        elif rule_type == "timestamp_gap" and previous_revision:
            threshold = rule.get("threshold", 0)
            gap_days = _time_gap_days(previous_revision.get("timestamp", ""), revision.get("timestamp", ""))
            matches = gap_days > threshold

        elif rule_type == "timestamp_gap_below" and previous_revision:
            threshold = rule.get("threshold", 0)
            gap_sec = _time_gap_seconds(previous_revision.get("timestamp", ""), revision.get("timestamp", ""))
            matches = gap_sec < threshold

        elif rule_type == "operation_type":
            selected = rule.get("selectedOperationTypes") or []
            if selected:
                matches = revision.get("operationCode", "") in selected

        elif rule_type == "suspected_ai_operations":
            ai_ops = ["REDESIGN_INTERFACE", "DESIGN_PROTEIN", "CALCULATE_PROTEIN_METRICS"]
            matches = revision.get("operationCode", "") in ai_ops

        if matches:
            if rule.get("autoScreen", False):
                return {"status": "flagged", "matched_rule_id": rule.get("id"), "auto_screening_recommended": True}
            return {"status": "flagged", "matched_rule_id": rule.get("id"), "auto_screening_recommended": False}

    return {"status": "default", "matched_rule_id": None, "auto_screening_recommended": False}


def apply_rules_to_revisions(
    revisions: List[Dict[str, Any]], rules: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """Apply rules to revisions. Returns (updated_revisions, rule_stats)."""
    sorted_revs = sorted(revisions, key=lambda r: r.get("revision", 0))
    rule_stats: Dict[str, int] = {}
    updated: List[Dict[str, Any]] = []

    for i, rev in enumerate(sorted_revs):
        prev = sorted_revs[i - 1] if i > 0 else None
        result = check_rules_for_revision(rev, rules, prev)

        status = result["status"]
        mid = result.get("matched_rule_id")
        if status == "flagged" and mid:
            rule_stats[mid] = rule_stats.get(mid, 0) + 1

        comments = list(rev.get("comments") or [])
        matched_rule = next((r for r in rules if r.get("id") == mid), None)

        if status == "flagged" and matched_rule:
            rule_comment = {"timestamp": rev.get("timestamp", ""), "text": f"Flagged by rule: {matched_rule.get('name', '')}"}
            if not any(c.get("text") == rule_comment["text"] for c in comments):
                comments.append(rule_comment)

        auto_screening_recommended = result.get("auto_screening_recommended", False)
        if auto_screening_recommended:
            auto_comment = {"timestamp": rev.get("timestamp", ""), "text": "Auto-screening recommended"}
            if not any(c.get("text") == auto_comment["text"] for c in comments):
                comments.append(auto_comment)

        updated.append({**rev, "status": status, "comments": comments, "auto_screening_recommended": auto_screening_recommended})

    return updated, rule_stats


def compute_revision_status(
    current_status: str,
    screening_status: Optional[str],
    failed_screening_keywords: List[str],
) -> str:
    """
    Compute effective revision status from current status and screening result.
    Priority (highest first): marked_safe, marked_unsafe > screening_failed, screening_passed > flagged > default.
    """
    if current_status in ("marked_safe", "marked_unsafe"):
        return current_status
    if screening_status is None:
        return current_status
    keywords = [k.lower() for k in failed_screening_keywords]
    if str(screening_status).lower() in keywords:
        return "screening_failed"
    return "screening_passed"


DEFAULT_FINAL_RECOMMENDATION = {
    "useFlaggedPercentage": False,
    "flaggedPercentageThreshold": 50,
    "useFailedScreeningCheck": False,
    "failedScreeningKeywords": ["controlled", "denied", "hazardous"],
}


def load_rules_config(rules_config_path: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Load rules and final-recommendation config.

    Returns (rules_list, final_recommendation_config).
    Supports both array format (rules only) and object format with "rules" and "finalRecommendation" keys.
    """
    path = rules_config_path or os.getenv("BMDE_RULES_CONFIG")
    if path:
        p = Path(path)
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            raise FileNotFoundError(f"Rules config file not found: {path}")
    else:
        data = _load_default_rules_raw()

    if isinstance(data, list):
        return data, DEFAULT_FINAL_RECOMMENDATION.copy()
    if isinstance(data, dict):
        rules = data.get("rules", [])
        final_rec = {**DEFAULT_FINAL_RECOMMENDATION}
        if "finalRecommendation" in data:
            fr = data["finalRecommendation"]
            final_rec.update({
                k: fr.get(k, v)
                for k, v in DEFAULT_FINAL_RECOMMENDATION.items()
                if k in fr or k in DEFAULT_FINAL_RECOMMENDATION
            })
            if "failedScreeningKeywords" in fr:
                final_rec["failedScreeningKeywords"] = list(fr["failedScreeningKeywords"])
        return rules, final_rec
    return [], DEFAULT_FINAL_RECOMMENDATION.copy()


def compute_final_recommendation(
    total_revisions: int,
    flagged_count: int,
    screening_statuses: List[Optional[str]],
    final_rec_config: Dict[str, Any],
) -> str:
    """
    Compute final recommendation: 'likely_safe', 'likely_unsafe', or 'safety_unclear'.

    Uses finalRecommendation config: useFlaggedPercentage, flaggedPercentageThreshold,
    useFailedScreeningCheck, failedScreeningKeywords.
    """
    use_flagged = final_rec_config.get("useFlaggedPercentage", False)
    use_screening = final_rec_config.get("useFailedScreeningCheck", False)
    if not use_flagged and not use_screening:
        return "safety_unclear"

    keywords = [k.lower() for k in (final_rec_config.get("failedScreeningKeywords") or [])]
    has_failed_screening = any(
        s and str(s).lower() in keywords
        for s in screening_statuses
    )
    flagged_pct = (flagged_count / total_revisions * 100) if total_revisions else 0
    threshold = final_rec_config.get("flaggedPercentageThreshold", 50)

    unsafe_from_flagged = use_flagged and flagged_pct >= threshold
    unsafe_from_screening = use_screening and has_failed_screening

    if unsafe_from_flagged or unsafe_from_screening:
        return "likely_unsafe"
    if use_screening and not any(s for s in screening_statuses):
        return "safety_unclear"
    return "likely_safe"


def load_rules(rules_config_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Load rules from a config file or the default package rules.

    Providers can specify their own rules via:
    - BMDE_RULES_CONFIG env var (path to JSON file)
    - rules_config_path argument (overrides env var)

    The JSON file may be:
    - A list of rule objects (legacy format)
    - An object with "rules" (array) and optional "finalRecommendation" (object)
    """
    rules, _ = load_rules_config(rules_config_path)
    return rules


def _load_default_rules_raw() -> Any:
    """Load the default rules from the package config."""
    try:
        from importlib.resources import files

        pkg = files("biodesign_metadata")
        config_file = pkg / "config" / "default_rules.json"
        return json.loads(config_file.read_text(encoding="utf-8"))
    except Exception:
        config_path = Path(__file__).parent / "config" / "default_rules.json"
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
