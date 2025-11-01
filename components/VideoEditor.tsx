import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateVideoFromImage, generateSpeech, editImage } from '../services/geminiService';
import { VeoGenerationState } from '../types';

const progressMessages = [
    "Analyzing source video...",
    "Extracting the perfect first frame...",
    "Consulting the AI muse...",
    "Reimagining your scene...",
    "Generative engines firing up...",
    "Rendering the new reality...",
    "Adding a touch of magic...",
];

const VideoEditor: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [audioPrompt, setAudioPrompt] = useState('');
    const [generationState, setGenerationState] = useState<VeoGenerationState>({ progress: 0, message: '', videoUrl: null, error: null });
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const [originalVideoFile, setOriginalVideoFile] = useState<File | null>(null);
    const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
            setApiKeySelected(true);
        }
    };
    
    const resetState = () => {
        setGenerationState({ progress: 0, message: '', videoUrl: null, error: null });
        setAudioUrl(null);
        setIsLoading(false);
        setIsGeneratingAudio(false);
        setPreviewImageUrl(null);
        setIsPreviewLoading(false);
    };
    
    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 250 * 1024 * 1024) {
                setGenerationState(prev => ({...prev, error: "File size should not exceed 250MB."}));
                return;
            }
            setOriginalVideoFile(file);
            const url = URL.createObjectURL(file);
            setOriginalVideoUrl(url);
            resetState();
        }
    }, []);

    const extractFrame = () => new Promise<File | null>((resolve) => {
        if (!videoRef.current) return resolve(null);
        const video = videoRef.current;
        const canvas = canvasRef.current;

        const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            if (!canvas) return resolve(null);
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], 'first-frame.png', { type: 'image/png' }));
                    } else {
                        resolve(null);
                    }
                }, 'image/png');
            } else {
                resolve(null);
            }
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = 0.1; // Seek to a very early frame to ensure it's loaded
    });

    const handlePreview = async () => {
        if (!originalVideoFile || !prompt.trim() || isPreviewLoading) return;
        setIsPreviewLoading(true);
        setPreviewImageUrl(null);
        setGenerationState(prev => ({...prev, error: null})); // Clear previous errors
        try {
            const frameFile = await extractFrame();
            if (!frameFile) throw new Error("Could not extract frame for preview.");
            const resultUrl = await editImage(frameFile, prompt);
            setPreviewImageUrl(resultUrl);
        } catch (err: any) {
            setGenerationState(prev => ({ ...prev, error: `Failed to generate preview: ${err.message}` }));
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!originalVideoFile || !prompt.trim() || isLoading) return;
        
        resetState();
        setIsLoading(true);

        try {
            const frameFile = await extractFrame();
            if (!frameFile) throw new Error("Could not extract frame from video.");

            const video = videoRef.current!;
            const aspectRatio = video.videoWidth > video.videoHeight ? '16:9' : '9:16';
            const generator = generateVideoFromImage(prompt, frameFile, aspectRatio);

            let messageIndex = 0;
            const messageInterval = setInterval(() => {
                setGenerationState(prev => ({ ...prev, message: progressMessages[messageIndex % progressMessages.length] }));
                messageIndex++;
            }, 3000);

            let finalVideoUrl: string | null = null;
            for await (const state of generator) {
                setGenerationState(prev => ({ ...prev, ...state }));
                 if (state.videoUrl) {
                    finalVideoUrl = state.videoUrl;
                }
                if (state.error) {
                    if (state.error.includes("entity was not found")) {
                        setApiKeySelected(false);
                        state.error = "API key not found or invalid. Please select a valid key.";
                    }
                    break;
                }
            }
            clearInterval(messageInterval);

            if (finalVideoUrl && audioPrompt.trim()) {
                setIsGeneratingAudio(true);
                try {
                    const generatedAudioUrl = await generateSpeech(audioPrompt);
                    setAudioUrl(generatedAudioUrl);
                } catch (audioErr: any) {
                    setGenerationState(prev => ({ ...prev, error: `${prev.error ? prev.error + ' ' : ''}Audio generation failed: ${audioErr.message}` }));
                } finally {
                    setIsGeneratingAudio(false);
                }
            }

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
    
    const handleDownloadVideo = async () => {
        if (!generationState.videoUrl) return;
        setIsDownloading(true);
        try {
            const response = await fetch(generationState.videoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const filename = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'edited_video';
            a.download = `${filename}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err: any) {
            setGenerationState(prev => ({...prev, error: `Download failed: ${err.message}`}));
        } finally {
            setIsDownloading(false);
        }
    };
    
    const handleDownloadAudio = (url: string) => {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const filename = audioPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'generated_audio';
        a.download = `${filename}.wav`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };


    const isGenerateDisabled = isLoading || !prompt.trim() || !originalVideoFile || (isCheckingApiKey || !apiKeySelected);
    const isPreviewDisabled = isPreviewLoading || isLoading || !prompt.trim() || !originalVideoFile;

    return (
        <div className="flex flex-col h-full bg-gray-800 p-6">
            <header className="mb-6">
                <h2 className="text-2xl font-bold font-orbitron">Generative Video Editor</h2>
                <p className="text-gray-400">Reimagine your video with a descriptive prompt.</p>
            </header>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
                {/* Controls Column */}
                <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
                     {!isCheckingApiKey && !apiKeySelected && (
                        <div className="bg-gray-700/50 border-2 border-dashed border-purple-800 rounded-lg p-4 text-center flex flex-col items-center gap-3">
                            <h3 className="font-bold text-lg text-purple-300">API Key Required</h3>
                            <p className="text-sm text-gray-400">This feature requires a personal API key. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline ml-1">Learn more</a>.</p>
                            <button onClick={handleSelectKey} className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 text-sm">Select Your API Key</button>
                        </div>
                    )}
                    {/* Video Upload & Preview */}
                    <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                         <h3 className="text-lg font-semibold">1. Upload & Preview</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="border border-gray-700 rounded-md p-1 flex flex-col">
                                <p className="text-xs text-center text-gray-400 mb-1">Original</p>
                                <div className="flex-1 flex items-center justify-center min-h-[150px]">
                                {originalVideoUrl ? (
                                    <video key={originalVideoUrl} controls src={originalVideoUrl} className="max-h-full max-w-full object-contain rounded-sm" />
                                ) : (
                                    <p className="text-sm text-gray-500">Upload video</p>
                                )}
                                </div>
                            </div>
                            <div className="border border-gray-700 rounded-md p-1 flex flex-col">
                                <p className="text-xs text-center text-gray-400 mb-1">Preview</p>
                                <div className="flex-1 flex items-center justify-center min-h-[150px] bg-black/20">
                                    {isPreviewLoading && <p className="text-sm text-purple-300">Generating...</p>}
                                    {!isPreviewLoading && previewImageUrl && <img src={previewImageUrl} alt="Effect preview" className="max-h-full max-w-full object-contain rounded-sm" />}
                                    {!isPreviewLoading && !previewImageUrl && <p className="text-sm text-gray-500">Preview appears here</p>}
                                </div>
                            </div>
                         </div>
                        <input type="file" accept="video/*" onChange={handleFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                    </div>
                    {/* Visual Prompt */}
                     <div>
                        <h3 className="text-lg font-semibold mb-2">2. Describe Your Visual Edit</h3>
                        <div className="relative">
                            <textarea
                                rows={4}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder="e.g., Add a futuristic cityscape in the background. Or, turn this into an anime style animation."
                                disabled={!originalVideoUrl}
                            />
                             <button onClick={handlePreview} disabled={isPreviewDisabled} className="absolute bottom-2 right-2 bg-gray-600 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                                {isPreviewLoading ? '...' : 'Preview Effect'}
                            </button>
                        </div>
                    </div>
                     {/* Audio Prompt */}
                     <div>
                        <h3 className="text-lg font-semibold mb-2">3. Describe Audio (Optional)</h3>
                        <textarea
                            rows={3}
                            value={audioPrompt}
                            onChange={(e) => setAudioPrompt(e.target.value)}
                            className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            placeholder="e.g., An epic cinematic soundtrack. Or, a voiceover saying 'In a world...'"
                            disabled={!originalVideoUrl}
                        />
                    </div>
                    {/* Generate Button */}
                    <button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center mt-auto">
                        Reimagine Video
                    </button>
                </div>
                
                {/* Result Column */}
                <div className="bg-gray-900 rounded-lg flex flex-col items-center justify-center p-4 overflow-hidden">
                    {generationState.error && <p className="text-red-400 text-center">{generationState.error}</p>}
                    {(isLoading || (generationState.progress > 0 && generationState.progress < 100)) && !generationState.error && (
                        <div className="w-full max-w-md text-center">
                            <p className="text-lg font-semibold text-purple-300 mb-2">{generationState.message}</p>
                            <div className="w-full bg-gray-700 rounded-full h-4"><div className="bg-purple-600 h-4 rounded-full transition-all" style={{ width: `${generationState.progress}%` }}></div></div>
                            <p className="text-sm text-gray-400 mt-2">{generationState.progress}%</p>
                        </div>
                    )}
                    {generationState.videoUrl && !generationState.error && (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <video key={generationState.videoUrl} controls autoPlay loop muted className="max-w-full max-h-[75%] object-contain rounded-md">
                                <source src={generationState.videoUrl} type="video/mp4" />
                            </video>
                             {isGeneratingAudio && <p className="mt-2 text-purple-300">Generating audio...</p>}
                            {audioUrl && (
                                <div className="w-full max-w-md mt-2">
                                    <audio key={audioUrl} controls autoPlay src={audioUrl} className="w-full"></audio>
                                </div>
                            )}
                            <div className="flex gap-4 mt-4">
                                <button onClick={handleDownloadVideo} disabled={isDownloading} className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-500">
                                    {isDownloading ? 'Downloading...' : 'Download Video'}
                                </button>
                                {audioUrl && (
                                    <button onClick={() => handleDownloadAudio(audioUrl)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">
                                        Download Audio
                                    </button>
                                )}
                            </div>
                            {audioUrl && <p className="text-xs text-gray-500 mt-2 text-center">Note: Audio and video are separate files. You will need video editing software to combine them.</p>}
                        </div>
                    )}
                    {!isLoading && !generationState.videoUrl && !generationState.error && (
                         <div className="text-center text-gray-500">
                             <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3l.01 6.333-2.48-2.488a.75.75 0 00-1.06 1.06l4.5 4.5a.75.75 0 001.06 0l4.5-4.5a.75.75 0 00-1.06-1.06l-2.488 2.488V3a.75.75 0 00-.75-.75H10.5a.75.75 0 00-.75.75zM19.5 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" /></svg>
                            <p>Your edited video will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
            {/* Hidden elements for processing */}
            <canvas ref={canvasRef} className="hidden"></canvas>
            {originalVideoUrl && <video ref={videoRef} src={originalVideoUrl} muted playsInline className="hidden" onLoadedData={() => videoRef.current?.pause()}></video>}
        </div>
    );
};

export default VideoEditor;