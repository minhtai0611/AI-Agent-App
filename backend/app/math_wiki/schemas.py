from pydantic import BaseModel, ConfigDict, field_validator


class WikiUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: str  # pattern | procedure | concept | mistake
    topic: str
    subtopic: str
    content: str
    problem_ids: list[str]

    @field_validator("problem_ids", mode="before")
    @classmethod
    def coerce_problem_ids(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return [str(x) for x in v]
        return v


class Problem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problem_id: str
    problem_text: str
    choices: list[str] | None = None
    correct_answer: str | None = None
    topic: str
    subtopic: str
    difficulty: str  # easy | medium | hard
    problem_type: str
    figure_svg: str | None = None


class FigureOutput(BaseModel):
    type: str
    data: str | None = None
    error: str | None = None


class SolverOutput(BaseModel):
    problem_type: str
    used_knowledge_ids: list[str]
    steps: list[str]
    final_answer: str
    confidence: str  # high | medium | low
    figure: "FigureOutput | None" = None


class ValidationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    valid: bool
    issues: list[str]


class ClassifyResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str


class RerankResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    top_ids: list[str]


class IngestOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problems: list[Problem]
    wiki_units: list[WikiUnit]


class ConceptIngestOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wiki_units: list[WikiUnit]


class ReviewOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verdict: str          # correct | partial | incorrect
    score: str            # "X/10"
    correct_steps: list[str]
    errors: list[str]
    feedback: str
    correct_approach: str = ""


class StagedWikiUnit(BaseModel):
    staged_id: str
    id: str
    type: str
    topic: str
    subtopic: str
    content: str
    problem_ids: list[str]
    source: str = "manual"
    source_url: str | None = None
    status: str = "pending"
    proposed_by: str = "system"
    created_at: str = ""

    @field_validator("problem_ids", mode="before")
    @classmethod
    def coerce_problem_ids(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return [str(x) for x in v]
        return v
