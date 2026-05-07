from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class AnalyticsOverviewResponse(BaseModel):
    total_institutions: int
    total_exams: int
    total_students: int
    total_violations: int

class ViolationDistributionItem(BaseModel):
    violation_type: str
    count: int

class TrendItem(BaseModel):
    date: date
    count: int

class TopViolatorItem(BaseModel):
    name: str
    violation_count: int

class AnalyticsDashboardResponse(BaseModel):
    overview: AnalyticsOverviewResponse
    violation_distribution: List[ViolationDistributionItem]
    violation_trend: List[TrendItem]
    session_trend: List[TrendItem]
    top_violators: List[TopViolatorItem]
