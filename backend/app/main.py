from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.config import get_settings
from app.dependencies import get_ai_client
from app.middleware import RateLimitMiddleware
from app.agent.core import run_agent
from app.agent.memory import compress_conversation

app = FastAPI(title="AI Agent App")

settings = get_settings()
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list[dict]
    customer_name: str = ""
    funnel_stage: str = ""


class ChatResponse(BaseModel):
    reply: str
    messages: list[dict]


class CompressRequest(BaseModel):
    messages: list[dict]


class CompressResponse(BaseModel):
    summary: str


# ── Exam AI models ───────────────────────────────────────────────────────────

class ExamAnalyzeRequest(BaseModel):
    result: dict
    history: list[dict] = []
    student_name: str = ""


class ExamAnalyzeResponse(BaseModel):
    insights: str
    weak_topics: list[str]
    recommendations: list[str]


class HintRequest(BaseModel):
    question: dict
    attempt_count: int = 1
    previous_hints: list[str] = []


class HintResponse(BaseModel):
    hint: str
    difficulty_note: str = ""


class TutorChatRequest(BaseModel):
    messages: list[dict]
    exam_context: dict
    student_name: str = ""


class TutorChatResponse(BaseModel):
    reply: str
    messages: list[dict]


class ExplainRequest(BaseModel):
    question: dict
    chosen_index: int


class ExplainResponse(BaseModel):
    correct_index: int
    explanation: str


class StudyPlanRequest(BaseModel):
    result: dict
    history: list[dict] = []
    student_name: str = ""


class StudyPlanResponse(BaseModel):
    plan: str
    weekly_schedule: list[dict]


# ── Existing routes ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    reply, updated = await run_agent(
        client,
        req.messages,
        customer_name=req.customer_name,
        funnel_stage=req.funnel_stage,
    )
    return ChatResponse(reply=reply, messages=updated)


@app.post("/compress", response_model=CompressResponse)
async def compress(
    req: CompressRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    summary = await compress_conversation(client, req.messages)
    return CompressResponse(summary=summary)


# ── Exam AI routes ───────────────────────────────────────────────────────────

@app.post("/analyze", response_model=ExamAnalyzeResponse)
async def analyze(
    req: ExamAnalyzeRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.exam_analyzer import analyze_exam_result
    try:
        data = await analyze_exam_result(client, req.result, req.history, req.student_name)
        return ExamAnalyzeResponse(
            insights=data.get("insights", ""),
            weak_topics=data.get("weak_topics", []),
            recommendations=data.get("recommendations", []),
        )
    except (ValueError, KeyError):
        raise HTTPException(status_code=502, detail="AI response parse error")


@app.post("/hint", response_model=HintResponse)
async def hint(
    req: HintRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.hint_generator import generate_hint
    try:
        data = await generate_hint(client, req.question, req.attempt_count, req.previous_hints)
        return HintResponse(
            hint=data.get("hint", ""),
            difficulty_note=data.get("difficulty_note", ""),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo gợi ý: {exc}")


@app.post("/tutor", response_model=TutorChatResponse)
async def tutor(
    req: TutorChatRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.exam_tutor import run_tutor
    reply, updated = await run_tutor(
        client, req.messages, req.exam_context, req.student_name
    )
    return TutorChatResponse(reply=reply, messages=updated)


@app.post("/explain", response_model=ExplainResponse)
async def explain(
    req: ExplainRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.exam_explainer import generate_explanation
    try:
        data = await generate_explanation(client, req.question, req.chosen_index)
        return ExplainResponse(
            correct_index=data.get("correct_index", 0),
            explanation=data.get("explanation", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo giải thích: {exc}")


@app.post("/study-plan", response_model=StudyPlanResponse)
async def study_plan(
    req: StudyPlanRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.study_planner import generate_study_plan
    data = await generate_study_plan(client, req.result, req.history, req.student_name)
    return StudyPlanResponse(
        plan=data.get("plan", ""),
        weekly_schedule=data.get("weekly_schedule", []),
    )
