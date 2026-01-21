"""
Voice-Gemini Server - Socket.IO server for Swedish AI Voice Assistant
Designed to work with Tauri frontend (lighter than Electron).
"""

import sys
import asyncio
import os
import signal

# Windows asyncio fix
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import socketio
import uvicorn
from fastapi import FastAPI
from dotenv import load_dotenv

from audio_loop import AudioLoop

load_dotenv()

# Create Socket.IO server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI(title="Alice Voice Service", version="1.0.0")
app_socketio = socketio.ASGIApp(sio, app)

# Global state
audio_loop = None
loop_task = None


def signal_handler(sig, frame):
    print(f"\n[SERVER] Caught signal {sig}. Exiting...")
    if audio_loop:
        audio_loop.stop()
    os._exit(0)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


@app.get("/")
async def root():
    return {
        "service": "Alice Voice (Gemini Native Audio)",
        "language": "Svenska",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "ok", "audio_active": audio_loop is not None}


@sio.event
async def connect(sid, environ):
    print(f"[SERVER] Client connected: {sid}")
    await sio.emit('status', {'msg': 'Connected to Alice Voice'}, room=sid)


@sio.event
async def disconnect(sid):
    print(f"[SERVER] Client disconnected: {sid}")


@sio.event
async def start_audio(sid, data=None):
    """Start the audio loop."""
    global audio_loop, loop_task
    
    print("[SERVER] Starting audio...")
    
    if audio_loop and loop_task and not loop_task.done():
        print("[SERVER] Audio already running")
        await sio.emit('status', {'msg': 'Already running'}, room=sid)
        return
    
    # Callbacks
    def on_audio_data(data_bytes):
        asyncio.create_task(sio.emit('audio_data', {'data': list(data_bytes)}))
    
    def on_transcription(data):
        asyncio.create_task(sio.emit('transcription', data))
    
    def on_tool_call(data):
        asyncio.create_task(sio.emit('tool_call', data))
    
    def on_error(msg):
        asyncio.create_task(sio.emit('error', {'msg': msg}))
    
    # Get device settings
    device_index = None
    if data:
        device_index = data.get('device_index')
    
    # Create audio loop
    audio_loop = AudioLoop(
        on_audio_data=on_audio_data,
        on_transcription=on_transcription,
        on_tool_call=on_tool_call,
        on_error=on_error,
        input_device_index=device_index,
        orchestrator_url=os.getenv("ORCHESTRATOR_URL", "http://localhost:8000")
    )
    
    # Check initial mute state
    if data and data.get('muted', False):
        audio_loop.set_paused(True)
    
    # Start in background
    loop_task = asyncio.create_task(audio_loop.run())
    
    def handle_exit(task):
        try:
            task.result()
        except asyncio.CancelledError:
            print("[SERVER] Audio loop cancelled")
        except Exception as e:
            print(f"[SERVER] Audio loop error: {e}")
    
    loop_task.add_done_callback(handle_exit)
    
    await sio.emit('status', {'msg': 'Alice Started'}, room=sid)


@sio.event
async def stop_audio(sid):
    """Stop the audio loop."""
    global audio_loop, loop_task
    
    if audio_loop:
        audio_loop.stop()
        audio_loop = None
        loop_task = None
        await sio.emit('status', {'msg': 'Alice Stopped'})


@sio.event
async def pause_audio(sid):
    """Pause audio (mute mic)."""
    if audio_loop:
        audio_loop.set_paused(True)
        await sio.emit('status', {'msg': 'Mic Muted'})


@sio.event
async def resume_audio(sid):
    """Resume audio."""
    if audio_loop:
        audio_loop.set_paused(False)
        await sio.emit('status', {'msg': 'Mic Active'})


@sio.event
async def user_input(sid, data):
    """Send text input to model."""
    text = data.get('text', '')
    
    if not text:
        return
    
    if not audio_loop or not audio_loop.session:
        await sio.emit('error', {'msg': 'Not connected'})
        return
    
    print(f"[SERVER] User text: {text}")
    await audio_loop.session.send(input=text, end_of_turn=True)


@sio.event
async def shutdown(sid, data=None):
    """Graceful shutdown."""
    global audio_loop, loop_task
    
    print("[SERVER] Shutdown requested")
    
    if audio_loop:
        audio_loop.stop()
        audio_loop = None
    
    if loop_task and not loop_task.done():
        loop_task.cancel()
        loop_task = None
    
    os._exit(0)


if __name__ == "__main__":
    print("=" * 50)
    print("  Alice Voice Service (Gemini Native Audio)")
    print("  Language: Svenska")
    print("  Port: 8002")
    print("=" * 50)
    
    uvicorn.run(
        app_socketio,
        host="0.0.0.0",
        port=8002,
        log_level="info"
    )
