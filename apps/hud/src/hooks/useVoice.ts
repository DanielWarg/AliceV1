"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useVoice Hook - Connects to Alice Voice Service via Socket.IO
 * Handles real-time audio communication with Gemini.
 */

interface VoiceState {
    isConnected: boolean;
    isListening: boolean;
    isSpeaking: boolean;
    transcript: string;
    lastResponse: string;
    error: string | null;
}

interface TranscriptionEvent {
    sender: 'User' | 'Alice';
    text: string;
}

interface UseVoiceOptions {
    serverUrl?: string;
    autoConnect?: boolean;
}

export function useVoice(options: UseVoiceOptions = {}) {
    const {
        serverUrl = 'http://localhost:8002',
        autoConnect = false
    } = options;

    const socketRef = useRef<any>(null);
    const [state, setState] = useState<VoiceState>({
        isConnected: false,
        isListening: false,
        isSpeaking: false,
        transcript: '',
        lastResponse: '',
        error: null,
    });

    // Dynamic import of socket.io-client
    useEffect(() => {
        if (!autoConnect) return;

        const connectSocket = async () => {
            try {
                const { io } = await import('socket.io-client');

                const socket = io(serverUrl, {
                    transports: ['websocket', 'polling'],
                });

                socket.on('connect', () => {
                    console.log('[Voice] Connected to Alice Voice Service');
                    setState(prev => ({ ...prev, isConnected: true, error: null }));
                });

                socket.on('disconnect', () => {
                    console.log('[Voice] Disconnected');
                    setState(prev => ({
                        ...prev,
                        isConnected: false,
                        isListening: false,
                        isSpeaking: false
                    }));
                });

                socket.on('status', (data: { msg: string }) => {
                    console.log('[Voice] Status:', data.msg);

                    if (data.msg === 'Alice Started') {
                        setState(prev => ({ ...prev, isListening: true }));
                    } else if (data.msg === 'Alice Stopped') {
                        setState(prev => ({ ...prev, isListening: false }));
                    } else if (data.msg === 'Mic Muted') {
                        setState(prev => ({ ...prev, isListening: false }));
                    } else if (data.msg === 'Mic Active') {
                        setState(prev => ({ ...prev, isListening: true }));
                    }
                });

                socket.on('transcription', (data: TranscriptionEvent) => {
                    console.log(`[Voice] ${data.sender}: ${data.text}`);

                    if (data.sender === 'User') {
                        setState(prev => ({
                            ...prev,
                            transcript: prev.transcript + data.text
                        }));
                    } else {
                        setState(prev => ({
                            ...prev,
                            lastResponse: prev.lastResponse + data.text,
                            isSpeaking: true
                        }));
                    }
                });

                socket.on('audio_data', () => {
                    // Audio is playing
                    setState(prev => ({ ...prev, isSpeaking: true }));
                });

                socket.on('error', (data: { msg: string }) => {
                    console.error('[Voice] Error:', data.msg);
                    setState(prev => ({ ...prev, error: data.msg }));
                });

                socketRef.current = socket;

                return () => {
                    socket.disconnect();
                };
            } catch (err) {
                console.error('[Voice] Failed to connect:', err);
                setState(prev => ({
                    ...prev,
                    error: err instanceof Error ? err.message : 'Connection failed'
                }));
            }
        };

        connectSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [serverUrl, autoConnect]);

    const startListening = useCallback(() => {
        if (socketRef.current?.connected) {
            setState(prev => ({ ...prev, transcript: '', lastResponse: '' }));
            socketRef.current.emit('start_audio');
        }
    }, []);

    const stopListening = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('stop_audio');
        }
    }, []);

    const toggleMute = useCallback(() => {
        if (!socketRef.current?.connected) return;

        if (state.isListening) {
            socketRef.current.emit('pause_audio');
        } else {
            socketRef.current.emit('resume_audio');
        }
    }, [state.isListening]);

    const sendText = useCallback((text: string) => {
        if (socketRef.current?.connected && text.trim()) {
            socketRef.current.emit('user_input', { text });
        }
    }, []);

    return {
        ...state,
        startListening,
        stopListening,
        toggleMute,
        sendText,
    };
}
