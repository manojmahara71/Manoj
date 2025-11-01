
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { startLiveConversation, LiveSession } from '../services/geminiService';
import { LiveServerMessage } from '@google/genai';

const LiveConversation: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('Idle. Press Start to talk.');
  const [transcription, setTranscription] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const userInputRef = useRef<string>('');
  const modelOutputRef = useRef<string>('');

  const handleMessage = (message: LiveServerMessage) => {
    let userText = '';
    let modelText = '';
    if (message.serverContent?.inputTranscription) {
      userText = message.serverContent.inputTranscription.text;
      userInputRef.current += userText;
    }
    if (message.serverContent?.outputTranscription) {
      modelText = message.serverContent.outputTranscription.text;
      modelOutputRef.current += modelText;
    }

    if (userText || modelText) {
      setTranscription(prev => [...prev, userText ? `You: ${userText}` : `Model: ${modelText}`]);
    }

    if (message.serverContent?.turnComplete) {
      userInputRef.current = '';
      modelOutputRef.current = '';
    }
  };

  const handleError = (e: ErrorEvent) => {
    console.error("Live session error:", e);
    setError("Connection error. Please try again.");
    stopSession();
  };

  const handleClose = (e: CloseEvent) => {
    setStatus('Session closed.');
    setIsSessionActive(false);
  };

  const startSession = useCallback(async () => {
    setError(null);
    setTranscription([]);
    setStatus('Requesting microphone access...');
    try {
      const session = await startLiveConversation({
        onMessage: handleMessage,
        onError: handleError,
        onClose: handleClose,
      });
      sessionRef.current = session;
      setIsSessionActive(true);
      setStatus('Listening... Speak now.');
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Could not access microphone or start session.');
      setStatus('Idle. Press Start to talk.');
    }
  }, []);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsSessionActive(false);
    setStatus('Session ended. Press Start to talk again.');
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);


  return (
    <div className="flex flex-col h-full bg-gray-800 p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Live Conversation</h2>
        <p className="text-gray-400">Talk with Gemini in real-time.</p>
      </header>
      
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-purple-500 shadow-2xl animate-pulse' : 'bg-gray-700'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </div>
        <p className="text-lg text-gray-300">{status}</p>
        
        {isSessionActive ? (
          <button onClick={stopSession} className="bg-red-600 text-white font-bold py-3 px-8 rounded-full hover:bg-red-700 transition-all">
            Stop Conversation
          </button>
        ) : (
          <button onClick={startSession} className="bg-purple-600 text-white font-bold py-3 px-8 rounded-full hover:bg-purple-700 transition-all">
            Start Conversation
          </button>
        )}
        {error && <p className="text-red-400">{error}</p>}
      </div>

      <div className="h-1/3 bg-gray-900 rounded-lg p-4 mt-6 overflow-y-auto">
        <h3 className="font-bold mb-2">Live Transcript</h3>
        <div className="text-gray-300 space-y-2 text-sm">
          {transcription.map((line, index) => (
            <p key={index} className="whitespace-pre-wrap">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveConversation;
