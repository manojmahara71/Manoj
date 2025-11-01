
import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';

const AudioTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    setTranscription('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = handleStopRecording;
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('Microphone access denied. Please enable it in your browser settings.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release the microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  const handleStopRecording = async () => {
    setIsLoading(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    try {
        const result = await transcribeAudio(audioBlob);
        setTranscription(result);
    } catch (err) {
        setError('Failed to transcribe audio. Please try again.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }


  return (
    <div className="flex flex-col h-full bg-gray-800 p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Audio Transcription</h2>
        <p className="text-gray-400">Record your voice and get a text transcript.</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 text-white font-bold ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-purple-600'}`}
        >
          {isRecording ? 'Stop' : 'Record'}
        </button>
        <p className="text-gray-400">
            {isRecording ? 'Recording...' : 'Press record to start'}
        </p>
         {error && <p className="text-red-400 mt-2">{error}</p>}
      </div>

      <div className="h-1/3 bg-gray-900 rounded-lg p-4 mt-6 overflow-y-auto">
        <h3 className="font-bold mb-2">Transcription</h3>
        <div className="text-gray-300">
          {isLoading && <p>Transcribing audio...</p>}
          {transcription && <p>{transcription}</p>}
          {!isLoading && !transcription && <p className="text-gray-500">Your transcript will appear here.</p>}
        </div>
      </div>
    </div>
  );
};

export default AudioTranscriber;
