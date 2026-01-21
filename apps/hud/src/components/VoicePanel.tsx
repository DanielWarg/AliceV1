"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Settings, X, ChevronDown, ChevronUp } from "lucide-react";
import Visualizer from "./Visualizer";
import { useVoice } from "../hooks/useVoice";

/**
 * VoicePanel - Röststyrd huvudpanel för Alice
 * Primärt gränssnitt - textinput är sekundärt
 */

const GlowDot = ({ className }: { className?: string }) => (
    <span className={`relative inline-block ${className || ""}`}>
        <span className="absolute inset-0 rounded-full blur-[6px] bg-cyan-400/40" />
        <span className="absolute inset-0 rounded-full blur-[14px] bg-cyan-400/20" />
        <span className="relative block h-full w-full rounded-full bg-cyan-300" />
    </span>
);

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function VoicePanel() {
    const voice = useVoice({
        serverUrl: process.env.NEXT_PUBLIC_VOICE_URL || 'http://localhost:8002',
        autoConnect: true
    });

    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hej! Jag är Alice. Klicka på mikrofonen för att börja prata med mig.', timestamp: new Date() }
    ]);
    const [textInput, setTextInput] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);
    const [now, setNow] = useState('');
    const [dateString, setDateString] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Uppdatera klockan och datum
    useEffect(() => {
        const updateTime = () => {
            const d = new Date();
            setNow(d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
            setDateString(d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }));
        };
        updateTime();
        const id = setInterval(updateTime, 1000);
        return () => clearInterval(id);
    }, []);

    // Lägg till transkriptioner som meddelanden
    useEffect(() => {
        if (voice.transcript) {
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'user') {
                    // Uppdatera senaste användarmeddelande
                    return [...prev.slice(0, -1), { ...last, content: voice.transcript }];
                }
                return [...prev, { role: 'user', content: voice.transcript, timestamp: new Date() }];
            });
        }
    }, [voice.transcript]);

    useEffect(() => {
        if (voice.lastResponse) {
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.content !== 'Hej! Jag är Alice. Klicka på mikrofonen för att börja prata med mig.') {
                    // Uppdatera senaste assistentmeddelande
                    return [...prev.slice(0, -1), { ...last, content: voice.lastResponse }];
                }
                return [...prev, { role: 'assistant', content: voice.lastResponse, timestamp: new Date() }];
            });
        }
    }, [voice.lastResponse]);

    // Auto-scrolla historik
    useEffect(() => {
        if (showHistory) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, showHistory]);

    const handleMicClick = () => {
        if (voice.isListening) {
            voice.stopListening();
        } else {
            voice.startListening();
        }
    };

    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (textInput.trim()) {
            setMessages(prev => [...prev, { role: 'user', content: textInput, timestamp: new Date() }]);
            voice.sendText(textInput);
            setTextInput('');
        }
    };

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#030b10] text-cyan-100 font-sans">
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-900/10" />
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_top,rgba(13,148,136,.15),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(3,105,161,.12),transparent_60%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(#0e7490_1px,transparent_1px),linear-gradient(90deg,#0e7490_1px,transparent_1px)] bg-[size:40px_40px] opacity-10" />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    {/* Status Indicator */}
                    <div className="flex items-center gap-3 bg-cyan-950/30 px-3 py-1.5 rounded-full border border-cyan-500/10 backdrop-blur-sm">
                        <GlowDot className={`h-2 w-2 transition-opacity duration-300 ${voice.isConnected ? 'opacity-100' : 'opacity-0'}`} />
                        <span className={`text-[10px] uppercase tracking-widest font-medium ${voice.isConnected ? 'text-cyan-300' : 'text-red-400'
                            }`}>
                            {voice.isConnected ? 'System Online' : 'Offline'}
                        </span>
                    </div>

                    {/* Clock & Settings */}
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-xl font-light text-cyan-100 tabular-nums">{now}</span>
                            <span className="text-[10px] uppercase tracking-widest text-cyan-400/60">{dateString}</span>
                        </div>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-cyan-500/10 rounded-full transition-colors text-cyan-400/80 hover:text-cyan-200"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-col items-center justify-center min-h-screen px-6 pt-20 pb-10 relative z-10 text-center">

                {/* Visualizer - Central focus */}
                <div className="mb-10 relative group">
                    <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full" />
                    <Visualizer
                        isListening={voice.isListening}
                        intensity={voice.isSpeaking ? 0.8 : 0.1}
                        width={320}
                        height={320}
                    />
                </div>

                {/* Mic Button - Primary control */}
                <button
                    onClick={handleMicClick}
                    className={`relative w-24 h-24 rounded-full border transition-all duration-300 group ${voice.isListening
                        ? 'border-cyan-400 bg-cyan-400/20 shadow-[0_0_50px_rgba(34,211,238,0.4)] scale-110'
                        : 'border-cyan-400/30 bg-cyan-900/10 hover:border-cyan-400/60 hover:bg-cyan-900/30'
                        }`}
                >
                    {voice.isListening ? (
                        <MicOff className="w-8 h-8 mx-auto text-cyan-200" />
                    ) : (
                        <Mic className="w-8 h-8 mx-auto text-cyan-400/80 group-hover:text-cyan-200 transition-colors" />
                    )}

                    {/* Ripple rings when listening */}
                    {voice.isListening && (
                        <>
                            <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-[ping_2s_linear_infinite]" />
                            <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-[ping_2s_linear_infinite_0.5s]" />
                        </>
                    )}
                </button>

                <p className="mt-6 text-sm font-light tracking-wide text-cyan-200/50 uppercase">
                    {voice.isListening ? 'Lyssnar...' : 'Klicka för att tala'}
                </p>

                {/* Status indicators */}
                <div className="flex items-center gap-4 mt-8">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${voice.isSpeaking ? 'bg-cyan-500/20 text-cyan-200' : 'bg-transparent text-cyan-500/30'
                        }`}>
                        {voice.isSpeaking ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                        <span>{voice.isSpeaking ? 'Alice talar' : 'Tyst'}</span>
                    </div>
                </div>

                {/* Conversation History Toggle */}
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="mt-12 flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-500/60 hover:text-cyan-300 transition-colors"
                >
                    {showHistory ? 'Dölj historik' : 'Visa historik'}
                    {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Conversation History Panel */}
                {showHistory && (
                    <div className="mt-4 w-full max-w-lg bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 p-4 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
                        <div className="space-y-4">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] text-cyan-500/50 mb-1 px-1">
                                        {msg.role === 'user' ? 'DU' : 'ALICE'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-cyan-500/20 text-cyan-100 rounded-tr-sm'
                                        : 'bg-white/5 text-cyan-200/90 rounded-tl-sm'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}

                {/* Text Input Toggle */}
                {!showTextInput && (
                    <button
                        onClick={() => setShowTextInput(true)}
                        className="fixed bottom-6 text-xs text-cyan-500/30 hover:text-cyan-400 transition-colors"
                    >
                        Tryck 'T' för textinmatning
                    </button>
                )}

                {/* Text Input (Secondary) */}
                {showTextInput && (
                    <div className="fixed bottom-8 w-full max-w-md px-6">
                        <form onSubmit={handleTextSubmit} className="relative">
                            <input
                                autoFocus
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder="Skriv meddelande..."
                                className="w-full bg-[#0a151a]/90 backdrop-blur-xl border border-cyan-500/30 rounded-full px-6 py-3 pr-12 text-cyan-100 placeholder:text-cyan-500/30 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-xl shadow-black/50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowTextInput(false)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-cyan-500/50 hover:text-cyan-300 rounded-full hover:bg-cyan-500/10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                )}
            </main>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#0b171f] border border-cyan-500/20 w-full max-w-md rounded-3xl shadow-2xl shadow-cyan-900/20 overflow-hidden relative">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                            <h2 className="text-lg font-medium text-cyan-100">Inställningar</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-1 text-cyan-500/50 hover:text-cyan-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Device Section */}
                            <div className="space-y-3">
                                <label className="text-xs uppercase tracking-widest text-cyan-500/60 font-medium">Ljudenhet (Input)</label>
                                <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-sm text-cyan-200/70 flex justify-between items-center">
                                    <span>Standardmikrofon</span>
                                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">Aktiv</span>
                                </div>
                            </div>

                            {/* Voice Model */}
                            <div className="space-y-3">
                                <label className="text-xs uppercase tracking-widest text-cyan-500/60 font-medium">Röstmodell</label>
                                <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-sm text-cyan-200/70">
                                    Gemini 2.5 Native (Svenska)
                                </div>
                            </div>

                            {/* Info */}
                            <div className="pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-cyan-500/40">Version</span>
                                    <span className="text-cyan-500/60 font-mono">2.0.0-hybrid</span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-2">
                                    <span className="text-cyan-500/40">Backend</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${voice.isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className={voice.isConnected ? 'text-emerald-400/80' : 'text-red-400/80'}>
                                            {voice.isConnected ? 'Ansluten' : 'Frånkopplad'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex justify-end">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-sm rounded-lg transition-colors"
                            >
                                Stäng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

