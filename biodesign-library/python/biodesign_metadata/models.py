"""
Data models for biodesign metadata evaluation.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

VALID_STATUSES = (
    "default",
    "flagged",
    "screening_failed",
    "screening_passed",
    "marked_unsafe",
    "marked_safe",
)

# Statuses that count as "flagged" for summary purposes
FLAGGED_STATUSES = ("flagged", "screening_failed", "marked_unsafe")


def _normalize_status(s: str) -> str:
    """Map legacy status values to new status system."""
    if not s:
        return "default"
    if s in ("yellow", "red"):
        return "flagged"
    if s in VALID_STATUSES:
        return s
    return s


@dataclass
class EvaluatedRevision:
    """
    A revision with evaluation results (status, comments) attached.
    Extensible for future fields like screening_results.
    """
    revision: int
    design: str
    operation_code: str
    operation_details: Dict[str, Any]
    change: str
    timestamp: str
    tool: str
    comments: List[Dict[str, str]] = field(default_factory=list)
    status: str = ""
    auto_screening_recommended: bool = False
    screening_status: Optional[str] = None  # 'controlled' | 'not_controlled' | 'needs_investigation'
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "revision": self.revision,
            "design": self.design,
            "operationCode": self.operation_code,
            "operationDetails": self.operation_details,
            "change": self.change,
            "timestamp": self.timestamp,
            "tool": self.tool,
            "comments": self.comments,
            "status": self.status,
            "autoScreeningRecommended": self.auto_screening_recommended,
            "screeningStatus": self.screening_status,
            **self.extra,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "EvaluatedRevision":
        """Load EvaluatedRevision from a dict (e.g. from results.json)."""
        return cls(
            revision=d["revision"],
            design=d["design"],
            operation_code=d.get("operationCode", ""),
            operation_details=d.get("operationDetails", {}),
            change=d.get("change", ""),
            timestamp=d.get("timestamp", ""),
            tool=d.get("tool", ""),
            comments=d.get("comments", []),
            status=_normalize_status(d.get("status", "")),
            auto_screening_recommended=d.get("autoScreeningRecommended", False),
            screening_status=d.get("screeningStatus"),
            extra={k: v for k, v in d.items() if k not in (
                "revision", "design", "operationCode", "operationDetails",
                "change", "timestamp", "tool", "comments", "status",
                "autoScreeningRecommended", "screeningStatus"
            )},

        )


@dataclass
class EvaluationSummary:
    """Summary statistics from evaluation."""

    design_name: str
    author: str
    total_revisions: int
    operation_counts: Dict[str, int]
    flagged_count: int
    auto_screening_recommended_count: int
    date_range: Optional[Dict[str, str]] = None
    rule_stats: Dict[str, int] = field(default_factory=dict)
    applied_rules: List[Dict[str, Any]] = field(default_factory=list)
    screening_status_counts: Dict[str, int] = field(default_factory=dict)
    final_recommendation: str = "safety_unclear"
    design_screening_status: Optional[str] = None  # Screening status for the final design
    design_screening_comment: Optional[str] = None  # Screening findings for the final design

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        d: Dict[str, Any] = {
            "finalRecommendation": self.final_recommendation,
            "designName": self.design_name,
            "author": self.author,
            "totalRevisions": self.total_revisions,
            "operationTypes": self.operation_counts,
            "flaggedRevisions": self.flagged_count,
            "autoScreeningRecommendedCount": self.auto_screening_recommended_count,
            "dateRange": self.date_range,
            "ruleStats": self.rule_stats,
            "appliedRules": self.applied_rules,
            "screeningStatusCounts": self.screening_status_counts,
        }
        if self.design_screening_status is not None:
            d["designScreeningStatus"] = self.design_screening_status
        if self.design_screening_comment is not None:
            d["designScreeningComment"] = self.design_screening_comment
        return d

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string for display or export."""
        return json.dumps(self.to_dict(), indent=indent)
        

@dataclass
class EvaluationResult:
    """
    Result of evaluating a design and its metadata.
    Can represent success or failure.
    """

    success: bool
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    metadata_id: Optional[str] = None
    parent_metadata_id: Optional[str] = None
    design_name: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    last_updated: Optional[str] = None
    revisions: List[EvaluatedRevision] = field(default_factory=list)
    summary: Optional[EvaluationSummary] = None
    metadata_json: Optional[dict] = None  # Full parsed metadata (for export)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization and export_for_viewer."""
        return {
            "success": self.success,
            "error": self.error,
            "warnings": self.warnings,
            "id": self.metadata_id,
            "parentMetadataId": self.parent_metadata_id,
            "designName": self.design_name,
            "author": self.author,
            "description": self.description,
            "lastUpdated": self.last_updated,
            "revisions": [r.to_dict() for r in self.revisions],
            "summary": self.summary.to_dict() if self.summary else None,
        }

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_dict(cls, d: dict) -> "EvaluationResult":
        """Load EvaluationResult from a dict (e.g. from results.json)."""
        revisions = [EvaluatedRevision.from_dict(r) for r in d.get("revisions", [])]
        summary_d = d.get("summary")
        summary = None
        if summary_d:
            summary = EvaluationSummary(
                design_name=summary_d.get("designName", "Unknown"),
                author=summary_d.get("author", "Unknown"),
                total_revisions=summary_d.get("totalRevisions", 0),
                operation_counts=summary_d.get("operationTypes", {}),
                flagged_count=summary_d.get("flaggedRevisions", 0),
                auto_screening_recommended_count=summary_d.get("autoScreeningRecommendedCount", 0),
                date_range=summary_d.get("dateRange"),
                rule_stats=summary_d.get("ruleStats", {}),
                applied_rules=summary_d.get("appliedRules", []),
                screening_status_counts=summary_d.get("screeningStatusCounts", {}),
                final_recommendation=summary_d.get("finalRecommendation", "safety_unclear"),
                design_screening_status=summary_d.get("designScreeningStatus"),
                design_screening_comment=summary_d.get("designScreeningComment"),
            )
        return cls(
            success=d.get("success", False),
            error=d.get("error"),
            warnings=d.get("warnings", []),
            metadata_id=d.get("id"),
            parent_metadata_id=d.get("parentMetadataId"),
            design_name=d.get("designName"),
            author=d.get("author"),
            description=d.get("description"),
            last_updated=d.get("lastUpdated"),
            revisions=revisions,
            summary=summary,
            metadata_json=None,
        )

    @classmethod
    def from_file(cls, path: str) -> "EvaluationResult":
        """Load EvaluationResult from a results.json file."""
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        return cls.from_dict(d)


