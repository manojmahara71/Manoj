
import React, { useState, useCallback } from 'react';
import { analyzeVideo } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

// NOTE: The Gemini API for video understanding has limitations on file size and processing.
// This is a simplified client-side implementation. In a production app, you would use
// a server-side process and the File API for large video uploads.

const VideoAnalyzer: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('What are the key moments in this video?');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        // Simple check for demonstration purposes. Gemini API has a 256MB limit.
        if (selectedFile.size > 250 * 1024 * 1024) {
            setError("File size should not exceed 250MB for this demo.");
            return;
        }
      setError(null);
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setAnalysis(null);
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!prompt.trim() || !file || isLoading) return;
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeVideo(file, prompt);
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze video. It might be too large or in an unsupported format.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Video Analysis</h2>
        <p className="text-gray-400">Upload a video and ask Gemini Pro to find key information.</p>
      </header>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
        <div className="flex flex-col bg-gray-900 rounded-lg p-4">
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-md mb-4">
            {videoUrl ? (
              <video src={videoUrl} controls className="max-h-full max-w-full object-contain rounded-md" />
            ) : (
              <div className="text-center text-gray-500 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p>Upload a video</p>
              </div>
            )}
          </div>
          <label className="w-full text-center bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 cursor-pointer">
            <span>Select Video File</span>
            <input type="file" accept="video/*" onChange={handleFileChange} className="hidden"/>
          </label>
          {fileName && <p className="text-center text-sm mt-2 text-gray-400">{fileName}</p>}
        </div>

        <div className="flex flex-col space-y-4">
          <div>
            <label className="block font-medium mb-1">Your Question</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-gray-700 rounded-md p-2"
              placeholder="e.g., What is the main subject of this video?"
              disabled={!videoUrl}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !prompt.trim() || !videoUrl}
            className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Video'}
          </button>
          <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-y-auto">
            <h3 className="font-bold mb-2">Analysis Result</h3>
            {isLoading && <p className="text-gray-400">Thinking...</p>}
            {error && <p className="text-red-400">{error}</p>}
            {analysis && <p className="text-gray-300 whitespace-pre-wrap">{analysis}</p>}
            {!analysis && !isLoading && !error && <p className="text-gray-500">Analysis will appear here.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalyzer;
