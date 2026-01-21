"""
Smart Home Router - Kasa device control endpoints.
Part of AliceV1 hybrid architecture.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import structlog

from ..agents.kasa_agent import KasaAgent

router = APIRouter(prefix="/api/smart-home", tags=["smart-home"])
logger = structlog.get_logger()

# Global agent instance
kasa_agent = KasaAgent()


class ControlLightRequest(BaseModel):
    target: str  # IP or alias
    action: str  # turn_on, turn_off, set
    brightness: Optional[int] = None
    color: Optional[str] = None


class DeviceResponse(BaseModel):
    ip: str
    alias: str
    model: str
    type: str
    is_on: bool
    brightness: Optional[int] = None
    has_color: bool = False
    has_brightness: bool = False


@router.on_event("startup")
async def startup():
    """Initialize Kasa agent on startup."""
    logger.info("Initializing Kasa agent")
    await kasa_agent.initialize()


@router.get("/discover")
async def discover_devices() -> Dict[str, Any]:
    """Discover Kasa devices on the network."""
    logger.info("Discovering Kasa devices")
    try:
        devices = await kasa_agent.discover_devices()
        return {
            "success": True,
            "count": len(devices),
            "devices": devices
        }
    except Exception as e:
        logger.error("Kasa discovery failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices")
async def list_devices() -> Dict[str, Any]:
    """List all known devices (without re-discovery)."""
    devices = []
    for ip, dev in kasa_agent.devices.items():
        devices.append({
            "ip": ip,
            "alias": dev.alias,
            "model": dev.model,
            "is_on": dev.is_on
        })
    return {"devices": devices}


@router.post("/control")
async def control_light(request: ControlLightRequest) -> Dict[str, Any]:
    """Control a Kasa device (on/off/brightness/color)."""
    logger.info("Controlling device", target=request.target, action=request.action)
    
    try:
        success = False
        
        if request.action == "turn_on":
            success = await kasa_agent.turn_on(request.target)
        elif request.action == "turn_off":
            success = await kasa_agent.turn_off(request.target)
        elif request.action == "set":
            if request.brightness is not None:
                success = await kasa_agent.set_brightness(request.target, request.brightness)
            if request.color is not None:
                success = await kasa_agent.set_color(request.target, request.color) or success
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")
        
        return {"success": success, "target": request.target, "action": request.action}
    
    except Exception as e:
        logger.error("Control failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{target}")
async def get_device_status(target: str) -> Dict[str, Any]:
    """Get current status of a device."""
    dev = kasa_agent._resolve_device(target)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device not found: {target}")
    
    try:
        await dev.update()
        return {
            "ip": target,
            "alias": dev.alias,
            "is_on": dev.is_on,
            "brightness": dev.brightness if hasattr(dev, 'brightness') else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
