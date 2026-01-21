"""
Voice-Gemini Service - Swedish AI Voice Assistant
Uses Gemini 2.5 Native Audio for real-time voice interaction.
Part of AliceV1 Hybrid Architecture.
"""

import asyncio
import base64
import os
import sys
import struct
import math
import time
from typing import Optional, Callable, Any

from dotenv import load_dotenv
import pyaudio

from google import genai
from google.genai import types

# Python 3.10 compatibility
if sys.version_info < (3, 11, 0):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

# Audio Configuration
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

# Model Configuration
MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025"

# Load environment
load_dotenv()

# Initialize Gemini client
client = genai.Client(
    http_options={"api_version": "v1beta"}, 
    api_key=os.getenv("GEMINI_API_KEY")
)

# Swedish system prompt
SWEDISH_SYSTEM_PROMPT = """Du är Alice – en intelligent svensk AI-assistent.

**Språk och ton:**
- Prata alltid på svenska, naturligt och vardagligt
- Var hjälpsam, vänlig och professionell
- Ge korta, koncisa svar när det passar
- Förklara mer utförligt vid behov

**Kapabiliteter:**
- Kan svara på frågor om allt möjligt
- Kan hjälpa med planering och organisation
- Kan styra smarta hem-enheter (lampor, etc.)
- Kan söka på webben

**Viktigt:**
- Svara alltid på svenska om inte användaren specifikt ber om annat språk
- Var ärlig om du inte vet något
- Fråga om förtydligande om något är oklart
"""

# Tool definitions for Alice
tools = [
    {'google_search': {}},
    {
        "function_declarations": [
            {
                "name": "control_smart_home",
                "description": "Styr smarta hem-enheter som lampor och uttag.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "device": {"type": "STRING", "description": "Enhetens namn eller IP"},
                        "action": {"type": "STRING", "description": "turn_on, turn_off, eller set"},
                        "brightness": {"type": "INTEGER", "description": "Ljusstyrka 0-100"},
                        "color": {"type": "STRING", "description": "Färgnamn som 'röd', 'blå', 'varm'"}
                    },
                    "required": ["device", "action"]
                }
            },
            {
                "name": "web_search",
                "description": "Söker på webben efter information.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {"type": "STRING", "description": "Sökfrågan"}
                    },
                    "required": ["query"]
                }
            }
        ]
    }
]

# Voice configuration - Swedish-compatible voice
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    output_audio_transcription={},
    input_audio_transcription={},
    system_instruction=SWEDISH_SYSTEM_PROMPT,
    tools=tools,
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="Aoede"  # Good for Swedish pronunciation
            )
        )
    )
)

# PyAudio instance
pya = pyaudio.PyAudio()


class AudioLoop:
    """
    Main audio processing loop for Gemini Native Audio.
    Handles microphone input, model communication, and speaker output.
    """
    
    def __init__(
        self,
        on_audio_data: Optional[Callable] = None,
        on_transcription: Optional[Callable] = None,
        on_tool_call: Optional[Callable] = None,
        on_error: Optional[Callable] = None,
        input_device_index: Optional[int] = None,
        orchestrator_url: str = "http://localhost:8000"
    ):
        self.on_audio_data = on_audio_data
        self.on_transcription = on_transcription
        self.on_tool_call = on_tool_call
        self.on_error = on_error
        self.input_device_index = input_device_index
        self.orchestrator_url = orchestrator_url
        
        # State
        self.audio_in_queue = None
        self.out_queue = None
        self.paused = False
        self.session = None
        self.stop_event = asyncio.Event()
        
        # Transcription tracking
        self._last_input_transcription = ""
        self._last_output_transcription = ""
        
        # Echo cancellation
        self.is_speaking = False
        
        # VAD state
        self._is_user_speaking = False
        self._silence_start_time = None
    
    def set_paused(self, paused: bool):
        """Pause/resume audio capture."""
        self.paused = paused
    
    def stop(self):
        """Stop the audio loop."""
        self.stop_event.set()
    
    def clear_audio_queue(self):
        """Clear playback queue (for interruption)."""
        try:
            count = 0
            while not self.audio_in_queue.empty():
                self.audio_in_queue.get_nowait()
                count += 1
            if count > 0:
                print(f"[AUDIO] Cleared {count} chunks from playback queue")
        except Exception as e:
            print(f"[AUDIO] Error clearing queue: {e}")
    
    async def send_realtime(self):
        """Send audio chunks to model."""
        while True:
            msg = await self.out_queue.get()
            await self.session.send(input=msg, end_of_turn=False)
    
    async def listen_audio(self):
        """Capture audio from microphone."""
        mic_info = pya.get_default_input_device_info()
        
        device_index = self.input_device_index
        if device_index is None:
            device_index = mic_info["index"]
        
        try:
            audio_stream = await asyncio.to_thread(
                pya.open,
                format=FORMAT,
                channels=CHANNELS,
                rate=SEND_SAMPLE_RATE,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=CHUNK_SIZE,
            )
        except OSError as e:
            print(f"[AUDIO] Failed to open input: {e}")
            if self.on_error:
                self.on_error(f"Microphone error: {e}")
            return
        
        # VAD constants
        VAD_THRESHOLD = 800
        SILENCE_DURATION = 0.5
        
        while not self.stop_event.is_set():
            if self.paused:
                await asyncio.sleep(0.1)
                continue
            
            try:
                data = await asyncio.to_thread(
                    audio_stream.read, CHUNK_SIZE, exception_on_overflow=False
                )
                
                # Echo cancellation
                if self.is_speaking:
                    continue
                
                # Send audio
                if self.out_queue:
                    await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})
                
                # VAD logic
                count = len(data) // 2
                if count > 0:
                    shorts = struct.unpack(f"<{count}h", data)
                    sum_squares = sum(s**2 for s in shorts)
                    rms = int(math.sqrt(sum_squares / count))
                else:
                    rms = 0
                
                if rms > VAD_THRESHOLD:
                    self._silence_start_time = None
                    if not self._is_user_speaking:
                        self._is_user_speaking = True
                        print(f"[VAD] Speech detected (RMS: {rms})")
                else:
                    if self._is_user_speaking:
                        if self._silence_start_time is None:
                            self._silence_start_time = time.time()
                        elif time.time() - self._silence_start_time > SILENCE_DURATION:
                            self._is_user_speaking = False
                            self._silence_start_time = None
                
            except Exception as e:
                print(f"[AUDIO] Read error: {e}")
                await asyncio.sleep(0.1)
        
        audio_stream.close()
    
    async def receive_audio(self):
        """Receive and process model responses."""
        try:
            while not self.stop_event.is_set():
                turn = self.session.receive()
                async for response in turn:
                    # Handle audio data
                    if data := response.data:
                        self.audio_in_queue.put_nowait(data)
                        self.is_speaking = True
                    
                    # Handle transcription
                    if response.server_content:
                        # User transcription
                        if response.server_content.input_transcription:
                            transcript = response.server_content.input_transcription.text
                            if transcript and transcript != self._last_input_transcription:
                                delta = transcript
                                if transcript.startswith(self._last_input_transcription):
                                    delta = transcript[len(self._last_input_transcription):]
                                self._last_input_transcription = transcript
                                
                                if delta:
                                    self.clear_audio_queue()
                                    if self.on_transcription:
                                        self.on_transcription({"sender": "User", "text": delta})
                        
                        # Model transcription
                        if response.server_content.output_transcription:
                            transcript = response.server_content.output_transcription.text
                            if transcript and transcript != self._last_output_transcription:
                                delta = transcript
                                if transcript.startswith(self._last_output_transcription):
                                    delta = transcript[len(self._last_output_transcription):]
                                self._last_output_transcription = transcript
                                
                                if delta:
                                    if self.on_transcription:
                                        self.on_transcription({"sender": "Alice", "text": delta})
                    
                    # Handle tool calls
                    if response.tool_call:
                        await self._handle_tool_calls(response.tool_call.function_calls)
                
                # Reset speaking state when turn ends
                self.is_speaking = False
                self._last_input_transcription = ""
                self._last_output_transcription = ""
                
        except Exception as e:
            print(f"[RECEIVE] Error: {e}")
            if self.on_error:
                self.on_error(str(e))
    
    async def _handle_tool_calls(self, function_calls):
        """Handle tool calls from the model."""
        import httpx
        
        for fc in function_calls:
            print(f"[TOOL] {fc.name}: {fc.args}")
            
            if self.on_tool_call:
                self.on_tool_call({"name": fc.name, "args": fc.args})
            
            result = "Verktyget är inte tillgängligt."
            
            try:
                if fc.name == "control_smart_home":
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            f"{self.orchestrator_url}/api/smart-home/control",
                            json={
                                "target": fc.args.get("device", ""),
                                "action": fc.args.get("action", "turn_on"),
                                "brightness": fc.args.get("brightness"),
                                "color": fc.args.get("color")
                            },
                            timeout=10.0
                        )
                        if resp.status_code == 200:
                            result = f"Klart! Enheten har {fc.args.get('action', 'uppdaterats')}."
                        else:
                            result = f"Kunde inte styra enheten: {resp.text}"
                
                elif fc.name == "web_search":
                    result = f"Söker efter: {fc.args.get('query', '')}"
                
            except Exception as e:
                result = f"Fel vid verktygsanrop: {e}"
            
            # Send result back to model
            await self.session.send(
                input=f"Verktygsresultat för {fc.name}: {result}",
                end_of_turn=True
            )
    
    async def play_audio(self):
        """Play audio from the output queue."""
        try:
            stream = await asyncio.to_thread(
                pya.open,
                format=FORMAT,
                channels=CHANNELS,
                rate=RECEIVE_SAMPLE_RATE,
                output=True,
            )
        except Exception as e:
            print(f"[AUDIO] Failed to open output: {e}")
            return
        
        while not self.stop_event.is_set():
            try:
                data = await asyncio.wait_for(
                    self.audio_in_queue.get(),
                    timeout=0.1
                )
                await asyncio.to_thread(stream.write, data)
                
                if self.on_audio_data:
                    self.on_audio_data(data)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"[AUDIO] Playback error: {e}")
        
        stream.close()
    
    async def run(self, start_message: Optional[str] = None):
        """Main run loop."""
        print("[ALICE] Starting Gemini Native Audio...")
        
        self.audio_in_queue = asyncio.Queue()
        self.out_queue = asyncio.Queue()
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            self.session = session
            print("[ALICE] Connected to Gemini")
            
            # Send start message
            if start_message:
                await session.send(input=start_message, end_of_turn=True)
            else:
                await session.send(
                    input="Hej! Jag är redo att hjälpa dig. Vad kan jag göra för dig?",
                    end_of_turn=True
                )
            
            # Run all tasks
            async with asyncio.TaskGroup() as tg:
                tg.create_task(self.send_realtime())
                tg.create_task(self.listen_audio())
                tg.create_task(self.receive_audio())
                tg.create_task(self.play_audio())
        
        print("[ALICE] Session ended")


# Standalone test
if __name__ == "__main__":
    def on_transcription(data):
        sender = data.get("sender", "?")
        text = data.get("text", "")
        print(f"[{sender}] {text}")
    
    async def main():
        loop = AudioLoop(on_transcription=on_transcription)
        await loop.run()
    
    asyncio.run(main())
