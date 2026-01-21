# Alice v2 Hybrid - Single Source of Truth

> **Senast uppdaterad:** 2026-01-21  
> **Status:** Operationell (Backend 5/5)

## Arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALICE HYBRID v2                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐ │
│  │ HUD      │───▶│ voice-gemini  │───▶│ Gemini Cloud         │ │
│  │ :3001    │    │ :8002         │    │ Native Audio (sv)    │ │
│  └──────────┘    └───────────────┘    └──────────────────────┘ │
│       │                 │                                       │
│       │                 ▼                                       │
│       │          ┌───────────────┐                              │
│       └─────────▶│ orchestrator  │◀────────┐                   │
│                  │ :18000        │         │                    │
│                  └───────────────┘         │                    │
│                         │                  │                    │
│           ┌─────────────┼──────────────┐   │                    │
│           ▼             ▼              ▼   ▼                    │
│    ┌──────────┐  ┌───────────┐  ┌──────────────┐               │
│    │ guardian │  │ redis     │  │ Smart Home   │               │
│    │ :8787    │  │ :6379     │  │ (Kasa)       │               │
│    └──────────┘  └───────────┘  └──────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tjänster

| Tjänst | Port | Beskrivning |
|--------|------|-------------|
| Guardian | 8787 | Systemövervakning, brownout protection |
| Orchestrator | 18000 | API gateway, routing, NLU |
| Voice (Gemini) | 8002 | Röst-AI (svenska), Socket.IO |
| Redis | 6379 | Cache |
| HUD | 3001 | Frontend (Next.js) |

## API Endpoints

### Orchestrator (:18000)

- `GET /health` - Liveness
- `GET /ready` - Readiness
- `POST /api/chat` - Chat med Alice
- `GET /api/smart-home/discover` - Upptäck Kasa-enheter
- `POST /api/smart-home/control` - Styr enhet
- `GET /api/web-agent/status` - Web agent status
- `POST /api/web-agent/run` - Kör browser-task

### Voice (:8002)

- `GET /health` - Health check
- Socket.IO events: `start_audio`, `stop_audio`, `transcription`

## Konfiguration

```bash
# .env
GEMINI_API_KEY=din_nyckel    # KRÄVS
OPENAI_API_KEY=...           # Valfritt (fallback)
```

## Starta

```bash
# Backend
docker-compose up -d

# Frontend
cd apps/hud && npm install && npm run dev
```

## Ändringslogg 2026-01-21

### Nya filer

| Fil | Beskrivning |
|-----|-------------|
| `services/voice-gemini/audio_loop.py` | Gemini Native Audio (svenska) |
| `services/voice-gemini/server.py` | Socket.IO server |
| `services/voice-gemini/Dockerfile` | Docker build |
| `services/orchestrator/src/agents/kasa_agent.py` | Smart Home |
| `services/orchestrator/src/agents/web_agent.py` | Playwright |
| `services/orchestrator/src/routers/smart_home.py` | API routes |
| `services/orchestrator/src/routers/web_agent.py` | API routes |
| `apps/hud/src/components/VoicePanel.tsx` | Röststyrt UI |
| `apps/hud/src/components/Visualizer.tsx` | Ripple-animation |
| `apps/hud/src/hooks/useVoice.ts` | Socket.IO hook |
| `tests/e2e/test_hybrid_system.py` | E2E tester |
| `.env.example.local` | Env-mall |

### Modifierade filer

| Fil | Ändring |
|-----|---------|
| `docker-compose.yml` | Lagt till voice-gemini, Gemini config |
| `services/orchestrator/main.py` | Registrerat nya routers |
| `services/orchestrator/requirements.txt` | python-kasa, playwright |
| `apps/hud/package.json` | socket.io-client |
| `apps/hud/src/app/page.tsx` | VoicePanel som startsida |

## Test Status

```
Backend Services:
[OK] Guardian: 200
[OK] Orchestrator: 200
[OK] Voice Service: 200
[OK] Smart Home API: 200
[OK] Web Agent API: 200

Results: 5/5 services operational
```
