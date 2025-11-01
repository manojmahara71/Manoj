
import React, { useState, useCallback } from 'react';
import { analyzeImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

const ImageAnalyzer: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Describe this image in detail.');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAnalysis(null);
      const base64 = await fileToBase64(selectedFile);
      setImage(base64);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!prompt.trim() || !file || isLoading) return;
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeImage(file, prompt);
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze image. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Image Analysis</h2>
        <p className="text-gray-400">Upload an image to understand its content.</p>
      </header>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
        <div className="flex flex-col bg-gray-900 rounded-lg p-4">
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-md mb-4">
            {image ? (
              <img src={image} alt="To be analyzed" className="max-h-full max-w-full object-contain rounded-md" />
            ) : (
              <div className="text-center text-gray-500 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p>Upload an image</p>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
        </div>

        <div className="flex flex-col space-y-4">
          <div>
            <label className="block font-medium mb-1">Your Question</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="e.g., What is happening in this picture?"
              disabled={!image}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !prompt.trim() || !image}
            className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Image'}
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

export default ImageAnalyzer;
