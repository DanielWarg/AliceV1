"""
Web Agent Router - Browser automation endpoints.
Part of AliceV1 hybrid architecture.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import structlog
import base64

from ..agents.web_agent import WebAgent

router = APIRouter(prefix="/api/web-agent", tags=["web-agent"])
logger = structlog.get_logger()

# Global agent instance
web_agent = WebAgent()

# Track active tasks
active_task = None


class WebTaskRequest(BaseModel):
    prompt: str
    timeout: Optional[int] = 60


class NavigateRequest(BaseModel):
    url: str


class ClickRequest(BaseModel):
    x: int
    y: int


class TypeRequest(BaseModel):
    text: str
    x: Optional[int] = None
    y: Optional[int] = None
    clear_before: bool = True
    press_enter: bool = False


class ScrollRequest(BaseModel):
    direction: str = "down"
    amount: int = 800


@router.post("/run")
async def run_task(request: WebTaskRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Run a browser automation task."""
    global active_task
    
    if active_task:
        raise HTTPException(status_code=409, detail="A task is already running")
    
    logger.info("Starting web agent task", prompt=request.prompt)
    
    try:
        result = await web_agent.run_task(request.prompt)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        logger.error("Web agent task failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/navigate")
async def navigate(request: NavigateRequest) -> Dict[str, Any]:
    """Navigate to a URL."""
    result = await web_agent.navigate(request.url)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/click")
async def click(request: ClickRequest) -> Dict[str, Any]:
    """Click at coordinates."""
    result = await web_agent.click(request.x, request.y)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/type")
async def type_text(request: TypeRequest) -> Dict[str, Any]:
    """Type text."""
    result = await web_agent.type_text(
        text=request.text,
        x=request.x,
        y=request.y,
        clear_before=request.clear_before,
        press_enter=request.press_enter
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/scroll")
async def scroll(request: ScrollRequest) -> Dict[str, Any]:
    """Scroll the page."""
    result = await web_agent.scroll(request.direction, request.amount)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.get("/screenshot")
async def screenshot() -> Dict[str, Any]:
    """Take a screenshot of the current page."""
    screenshot_bytes = await web_agent.screenshot()
    if not screenshot_bytes:
        raise HTTPException(status_code=500, detail="Browser not initialized")
    
    encoded = base64.b64encode(screenshot_bytes).decode('utf-8')
    return {
        "success": True,
        "image": encoded,
        "format": "png"
    }


@router.get("/status")
async def get_status() -> Dict[str, Any]:
    """Get current browser status."""
    content = await web_agent.get_page_content()
    return {
        "active": web_agent.page is not None,
        **content
    }
