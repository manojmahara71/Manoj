
import React, { useState, useRef } from 'react';
import { generateSpeech } from '../services/geminiService';

const TextToSpeech: React.FC = () => {
  const [text, setText] = useState('Hello! I am Gemini. I can convert your text into speech.');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const handleGenerateSpeech = async () => {
    if (!text.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setAudioSrc(null);

    try {
      const audioUrl = await generateSpeech(text);
      setAudioSrc(audioUrl);
    } catch (err) {
      setError('Failed to generate speech. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-800 p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Text-to-Speech</h2>
        <p className="text-gray-400">Convert text into natural-sounding audio.</p>
      </header>
      
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex-grow">
          <label htmlFor="tts-text" className="block text-sm font-medium text-gray-300 mb-1">Text to Synthesize</label>
          <textarea
            id="tts-text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Enter text here..."
          />
        </div>

        <button
          onClick={handleGenerateSpeech}
          disabled={isLoading || !text.trim()}
          className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? 'Generating Audio...' : 'Generate Speech'}
        </button>

        {error && <p className="text-red-400 text-center">{error}</p>}
        
        {audioSrc && (
          <div className="mt-4">
            <h3 className="font-bold mb-2">Generated Audio</h3>
            <audio ref={audioRef} controls src={audioSrc} className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextToSpeech;
