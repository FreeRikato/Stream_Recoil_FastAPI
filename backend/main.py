import asyncio
import os
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from langchain_groq import ChatGroq
from langchain_mistralai import ChatMistralAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.callbacks.base import AsyncCallbackHandler
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize LLM with configuration from environment variables
llm = ChatGroq(
    model="llama-3.1-70b-versatile",
    # model="llama-3.2-1b-preview",
    # model="llama-3.2-90b-text-preview",
    # model="gemma2-9b-it",
    temperature=1.0,
    streaming=True,
)


# llm = ChatMistralAI(
#     model="mistral-large-2407",
#     temperature=0,
#     streaming=True,
#     # other params...
# )


# llm = ChatGoogleGenerativeAI(
#     model="gemini-1.5-flash",
#     temperature=1,
#     stremaing=True,
# )


class WebSocketCallbackHandler(AsyncCallbackHandler):
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

    async def on_llm_new_token(self, token: str, **kwargs) -> None:
        await self.websocket.send_text(json.dumps({"message": token}))


async def handle_websocket_message(websocket: WebSocket, data: str):
    try:
        message_json = json.loads(data)
        user_message = message_json.get("message")

        messages = [
            SystemMessage(
                content="You are a helpful assistant. Render the response with best markdown formatting in a structured way."
            ),
            HumanMessage(content=user_message),
        ]

        callback_handler = WebSocketCallbackHandler(websocket)
        await llm.agenerate([messages], callbacks=[callback_handler])
        await websocket.send_text(json.dumps({"message": "[END]"}))
    except json.JSONDecodeError:
        logger.error("Failed to decode JSON message")
        await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        await websocket.send_text(json.dumps({"error": "Internal server error"}))


@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await handle_websocket_message(websocket, data)
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
