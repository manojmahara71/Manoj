import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateVideoFromText, generateVideoFromImage, transcribeAudio } from '../services/geminiService';
import { VeoGenerationState } from '../types';

// More engaging progress messages
const progressMessages = [
    "Warming up the AI engines...",
    "Gathering creative inspiration...",
    "Directing the digital actors...",
    "Rendering the first few frames...",
    "Applying cinematic magic...",
    "Polishing the final cut...",
    "Almost there, adding the sparkle...",
];

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [generationState, setGenerationState] = useState<VeoGenerationState>({ progress: 0, message: '', videoUrl: null, error: null });
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    
    const [isDownloading, setIsDownloading] = useState(false);

    // Check for API key on mount
    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
            setIsCheckingApiKey(false);
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success after opening the dialog to avoid race conditions
            setApiKeySelected(true);
        }
    };
    
    const resetState = () => {
        setGenerationState({ progress: 0, message: '', videoUrl: null, error: null });
        setIsLoading(false);
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || isLoading) return;
        resetState();
        setIsLoading(true);

        const generator = imageFile
            ? generateVideoFromImage(prompt, imageFile, aspectRatio as '16:9' | '9:16')
            : generateVideoFromText(prompt, aspectRatio as '16:9' | '9:16');

        try {
            let messageIndex = 0;
            const messageInterval = setInterval(() => {
                setGenerationState(prev => ({ ...prev, message: progressMessages[messageIndex % progressMessages.length] }));
                messageIndex++;
            }, 3000);

            for await (const state of generator) {
                setGenerationState(prev => ({ ...prev, ...state }));
                if (state.error) {
                    // Check for common API key error
                    if (state.error.includes("entity was not found")) {
                        setApiKeySelected(false);
                        state.error = "API key not found or invalid. Please select a valid key.";
                    }
                    break;
                }
            }
            clearInterval(messageInterval);

        } catch (err: any) {
            let errorMessage = err.message;
            if (err.message && err.message.includes("entity was not found")) {
                setApiKeySelected(false);
                errorMessage = "API key not found or invalid. Please select a valid key.";
            }
            setGenerationState({ progress: 100, message: 'An unexpected error occurred.', videoUrl: null, error: errorMessage });
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setImageUrl(url);
            resetState();
        }
    }, []);
    
    const handleClearImage = () => {
        setImageFile(null);
        setImageUrl(null);
    };

    // --- Audio Recording Handlers ---
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = handleStopRecording;
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Mic access denied", err);
            setGenerationState(prev => ({...prev, error: "Microphone access denied."}));
        }
    };

    const handleStopRecording = async () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            // Stop mic tracks to turn off the indicator
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            setIsTranscribing(true);

            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            try {
                const transcript = await transcribeAudio(audioBlob);
                setPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
            } catch (err: any) {
                console.error("Transcription failed", err);
                setGenerationState(prev => ({...prev, error: `Transcription failed: ${err.message}`}));
            } finally {
                setIsTranscribing(false);
            }
        }
    };
    
    const handleDownloadVideo = async () => {
        if (!generationState.videoUrl) return;
        setIsDownloading(true);
        try {
            // The service already appends the API key, so we can fetch directly.
            const response = await fetch(generationState.videoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const filename = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'generated_video';
            a.download = `${filename}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err: any) {
            setGenerationState(prev => ({...prev, error: `Download failed: ${err.message}`}));
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    };

    const isGenerateDisabled = isLoading || !prompt.trim() || (isCheckingApiKey || !apiKeySelected);

    return (
        <div className="flex flex-col h-full bg-gray-800 p-6">
            <header className="mb-6">
                <h2 className="text-2xl font-bold font-orbitron">Veo Video Generation</h2>
                <p className="text-gray-400">Create high-quality video from text or an initial image.</p>
            </header>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
                {/* Controls Column */}
                <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
                    {/* API Key Selection */}
                    {!isCheckingApiKey && !apiKeySelected && (
                        <div className="bg-gray-700/50 border-2 border-dashed border-purple-800 rounded-lg p-4 text-center flex flex-col items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <h3 className="font-bold text-lg text-purple-300">API Key Required</h3>
                            <p className="text-sm text-gray-400 max-w-md">
                                Veo video generation requires a personal API key for secure access and billing.
                                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline ml-1">Learn more</a>.
                            </p>
                            <button onClick={handleSelectKey} className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 text-sm transition-transform transform hover:scale-105">
                                Select Your API Key
                            </button>
                        </div>
                    )}

                    {/* Prompt */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Prompt</label>
                        <div className="relative">
                            <textarea
                                rows={4}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full bg-gray-700 rounded-md p-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="e.g., A neon hologram of a cat driving a sports car"
                            />
                            <button
                                onClick={isRecording ? handleStopRecording : handleStartRecording}
                                disabled={isTranscribing}
                                className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600 hover:bg-purple-600'}`}
                                title={isRecording ? "Stop Recording" : "Record Prompt"}
                            >
                                {isTranscribing ? (
                                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Starting Image (Optional)</label>
                        <div className="relative flex items-center justify-center w-full h-32 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-md">
                            {imageUrl ? (
                                <>
                                    <img src={imageUrl} alt="Upload preview" className="h-full w-full object-contain p-1 rounded-md" />
                                     <button onClick={handleClearImage} className="absolute top-1 right-1 bg-gray-900/70 p-1 rounded-full text-white hover:bg-red-600 leading-none">&times;</button>
                                </>
                            ) : (
                                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full h-full opacity-0 cursor-pointer absolute inset-0" />
                            )}
                            {!imageUrl && <p className="text-gray-500">Click or drag to upload</p>}
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                            <option value="16:9">Landscape (16:9)</option>
                            <option value="9:16">Portrait (9:16)</option>
                        </select>
                    </div>
                    
                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerateDisabled}
                        className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center mt-auto"
                    >
                        Generate Video
                    </button>
                </div>
                
                {/* Result Column */}
                <div className="bg-gray-900 rounded-lg flex flex-col items-center justify-center p-4 overflow-hidden">
                    {generationState.error && <p className="text-red-400 text-center">{generationState.error}</p>}
                    
                    {(isLoading || generationState.progress > 0 && generationState.progress < 100) && !generationState.error && (
                        <div className="w-full max-w-md text-center">
                            <p className="text-lg font-semibold text-purple-300 mb-2">{generationState.message}</p>
                            <div className="w-full bg-gray-700 rounded-full h-4">
                                <div className="bg-purple-600 h-4 rounded-full transition-all duration-500" style={{ width: `${generationState.progress}%` }}></div>
                            </div>
                            <p className="text-sm text-gray-400 mt-2">{generationState.progress}%</p>
                            <p className="text-xs text-gray-500 mt-4">Video generation can take a few minutes. Please be patient.</p>
                        </div>
                    )}

                    {generationState.videoUrl && !generationState.error && (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <video key={generationState.videoUrl} controls autoPlay loop className="max-w-full max-h-[85%] object-contain rounded-md">
                                <source src={generationState.videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            <button 
                              onClick={handleDownloadVideo} 
                              disabled={isDownloading}
                              className="mt-4 bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-500"
                            >
                                {isDownloading ? 'Downloading...' : 'Download Video'}
                            </button>
                        </div>
                    )}

                    {!isLoading && !generationState.videoUrl && !generationState.error && (
                         <div className="text-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            <p>Your generated video will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoGenerator;