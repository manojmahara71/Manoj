
import React, { useState, useCallback } from 'react';
import { editImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setEditedImage(null);
      const base64 = await fileToBase64(selectedFile);
      setOriginalImage(base64);
    }
  }, []);

  const handleEdit = async () => {
    if (!prompt.trim() || !file || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const resultImageUrl = await editImage(file, prompt);
      setEditedImage(resultImageUrl);
    } catch (err: any) {
      setError(`Failed to edit image: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownload = () => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.href = editedImage;
    const filename = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'edited';
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Image Magic Editor</h2>
        <p className="text-gray-400">Describe the changes you want to make to your image.</p>
      </header>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
        <div className="flex flex-col bg-gray-900 rounded-lg p-4">
          <h3 className="font-bold mb-2">1. Upload Image</h3>
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-md">
            {originalImage ? (
              <img src={originalImage} alt="Original" className="max-h-full max-w-full object-contain rounded-md" />
            ) : (
              <div className="text-center text-gray-500 p-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p>Upload an image to start editing</p>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleFileChange} className="mt-4 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
        </div>

        <div className="flex flex-col space-y-4">
          <div>
            <h3 className="font-bold mb-2">2. Describe Your Edit</h3>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="e.g., Add a retro filter, remove the person in the background"
              disabled={!originalImage}
            />
          </div>
          <button
            onClick={handleEdit}
            disabled={isLoading || !prompt.trim() || !originalImage}
            className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? 'Editing...' : 'Apply Magic Edit'}
          </button>
          <div className="flex-1 bg-gray-900 rounded-lg p-4 flex items-center justify-center relative">
            {isLoading && <p>Applying edit...</p>}
            {error && <p className="text-red-400">{error}</p>}
            {editedImage && (
              <>
                <img src={editedImage} alt="Edited" className="max-h-full max-w-full object-contain rounded-md" />
                <button
                  onClick={handleDownload}
                  className="absolute top-4 right-4 bg-gray-800/70 p-2 rounded-full text-white hover:bg-purple-600 transition-colors"
                  title="Download Image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </>
            )}
            {!editedImage && !isLoading && !error && <p className="text-gray-500">Your edited image will appear here.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
