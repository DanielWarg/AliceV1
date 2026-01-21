"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import Visualizer from "./Visualizer";
import { useVoice } from "../hooks/useVoice";

/**
 * VoicePanel - Röststyrd huvudpanel för Alice
 * Primärt gränssnitt - textinput är sekundärt
 */

// Ikoner
const Svg = (p: any) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p} />);
const IconSettings = (p: any) => (<Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>);
const IconClock = (p: any) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v6h5" /></Svg>);

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
    const [now, setNow] = useState('--:--');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Uppdatera klockan
    useEffect(() => {
        setNow(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
        const id = setInterval(() => {
            setNow(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
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

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
        <div className="relative min-h-screen w-full overflow-hidden bg-[#030b10] text-cyan-100">
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-900/10" />
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_top,rgba(13,148,136,.15),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(3,105,161,.12),transparent_60%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(#0e7490_1px,transparent_1px),linear-gradient(90deg,#0e7490_1px,transparent_1px)] bg-[size:40px_40px] opacity-10" />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-4">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <div className="flex items-center gap-2">
                        <GlowDot className="h-2 w-2" />
                        <span className={`text-xs uppercase tracking-widest ${voice.isConnected ? 'text-cyan-300' : 'text-red-400'
                            }`}>
                            {voice.isConnected ? 'Ansluten' : 'Ej ansluten'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-cyan-300/80">
                        <IconClock className="h-4 w-4" />
                        <span className="tracking-widest text-xs">{now}</span>
                        <button className="hover:text-cyan-200 transition-colors">
                            <IconSettings className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-col items-center justify-center min-h-screen px-6 py-24">

                {/* Visualizer - Central focus */}
                <div className="mb-8">
                    <Visualizer
                        isListening={voice.isListening}
                        intensity={voice.isSpeaking ? 0.7 : 0}
                        width={400}
                        height={400}
                    />
                </div>

                {/* Mic Button - Primary control */}
                <button
                    onClick={handleMicClick}
                    className={`relative w-20 h-20 rounded-full border-2 transition-all duration-300 ${voice.isListening
                            ? 'border-cyan-400 bg-cyan-400/20 shadow-[0_0_40px_rgba(34,211,238,0.5)]'
                            : 'border-cyan-400/30 bg-cyan-900/20 hover:border-cyan-400/60'
                        }`}
                >
                    {voice.isListening ? (
                        <MicOff className="w-8 h-8 mx-auto text-cyan-300" />
                    ) : (
                        <Mic className="w-8 h-8 mx-auto text-cyan-300" />
                    )}

                    {/* Pulsating ring when listening */}
                    {voice.isListening && (
                        <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-50" />
                    )}
                </button>

                <p className="mt-4 text-sm text-cyan-300/60">
                    {voice.isListening ? 'Lyssnar... Klicka för att stoppa' : 'Klicka för att prata med Alice'}
                </p>

                {/* Status indicators */}
                <div className="flex items-center gap-6 mt-6 text-xs text-cyan-300/50">
                    <div className="flex items-center gap-2">
                        {voice.isSpeaking ? (
                            <Volume2 className="w-4 h-4 text-cyan-400" />
                        ) : (
                            <VolumeX className="w-4 h-4" />
                        )}
                        <span>{voice.isSpeaking ? 'Alice pratar' : 'Tyst'}</span>
                    </div>
                </div>

                {/* Toggle text input */}
                <button
                    onClick={() => setShowTextInput(!showTextInput)}
                    className="mt-8 text-xs text-cyan-300/40 hover:text-cyan-300/70 transition-colors"
                >
                    {showTextInput ? 'Dölj textfält' : 'Visa textfält'}
                </button>

                {/* Text input (secondary) */}
                {showTextInput && (
                    <form onSubmit={handleTextSubmit} className="mt-4 w-full max-w-md">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder="Eller skriv här..."
                                className="flex-1 bg-cyan-900/20 border border-cyan-400/30 rounded-xl px-4 py-2 text-cyan-100 placeholder:text-cyan-300/40 focus:outline-none focus:border-cyan-400/60"
                            />
                            <button
                                type="submit"
                                disabled={!textInput.trim()}
                                className="px-4 py-2 bg-cyan-400/20 border border-cyan-400/30 rounded-xl text-cyan-200 hover:bg-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Skicka
                            </button>
                        </div>
                    </form>
                )}

                {/* Conversation history (collapsible) */}
                <div className="mt-8 w-full max-w-md">
                    <details className="group">
                        <summary className="text-xs text-cyan-300/50 cursor-pointer hover:text-cyan-300/70 list-none">
                            Konversationshistorik ({messages.length} meddelanden)
                        </summary>
                        <div className="mt-4 max-h-60 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                                            ? 'bg-cyan-400/20 border border-cyan-400/30'
                                            : 'bg-cyan-900/30 border border-cyan-500/20'
                                        }`}>
                                        <div className="text-[10px] text-cyan-300/50 mb-1">
                                            {msg.role === 'user' ? 'Du' : 'Alice'}
                                        </div>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </details>
                </div>
            </main>

            {/* Error display */}
            {voice.error && (
                <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-900/50 border border-red-400/30 rounded-xl px-4 py-3 text-sm text-red-200">
                    {voice.error}
                </div>
            )}
        </div>
    );
}
