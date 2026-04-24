from fastapi import FastAPI, Depends
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.dependencies import get_ai_client
from app.agent.core import run_agent
from app.agent.memory import compress_conversation

app = FastAPI(title="AI Agent App")


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
