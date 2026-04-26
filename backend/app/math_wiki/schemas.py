from pydantic import BaseModel, ConfigDict


class WikiUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: str  # pattern | procedure | concept | mistake
    topic: str
    subtopic: str
    content: str
    problem_ids: list[str]


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


class SolverOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problem_type: str
    used_knowledge_ids: list[str]
    steps: list[str]
    final_answer: str
    confidence: str  # high | medium | low


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
