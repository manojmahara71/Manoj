import { GoogleGenAI, GenerateContentResponse, Modality, Type, LiveServerMessage } from '@google/genai';
import { VeoGenerationState } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

// --- UTILITY FUNCTIONS FOR AUDIO & LIVE API ---

// Decode base64 string to Uint8Array
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encode Uint8Array to base64 string
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decode raw PCM audio data into an AudioBuffer for playback
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper to write string to DataView
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Converts raw PCM data to a WAV file Blob
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // Audio format 1 for PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // blockAlign
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data
  new Uint8Array(buffer, 44).set(pcmData);

  return new Blob([view], { type: 'audio/wav' });
}


// --- API SERVICE FUNCTIONS ---

const getAiClient = () => {
    // The API key is injected by the environment and is assumed to be available.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// 1. Chat (Streaming)
export async function* generateChatResponseStream(
    prompt: string,
    mode: 'lite' | 'flash' | 'pro',
    grounding: 'none' | 'search' | 'maps' | 'auto'
): AsyncGenerator<{ text?: string, groundingChunks?: any[] }> {
    const ai = getAiClient();
    const modelMap = {
        lite: 'gemini-flash-lite-latest',
        flash: 'gemini-2.5-flash',
        pro: 'gemini-2.5-pro',
    };

    let tools: any[] = [];
    let toolConfig: any = {};
    const needsLocation = grounding === 'maps' || grounding === 'auto';

    if (grounding === 'search' || grounding === 'auto') {
        tools.push({ googleSearch: {} });
    }
    if (grounding === 'maps' || grounding === 'auto') {
        tools.push({ googleMaps: {} });
    }

    if (needsLocation) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            toolConfig.retrievalConfig = {
                latLng: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }
            };
        } catch (e) {
            console.warn("Could not get user location for Maps grounding.");
        }
    }

    const config: any = {
      ...(tools.length > 0 && { tools }),
      ...(Object.keys(toolConfig).length > 0 && { toolConfig }),
    };
    if (mode === 'pro') {
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    const responseStream = await ai.models.generateContentStream({
        model: modelMap[mode],
        contents: prompt,
        ...(Object.keys(config).length > 0 && { config }),
    });
    
    for await (const chunk of responseStream) {
        yield {
            text: chunk.text,
            groundingChunks: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
        };
    }
};

// 2. Image Generation
export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

// 3. Image Editing
export const editImage = async (imageFile: File, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const base64Data = await fileToBase64(imageFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: imageFile.type } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error('No edited image found in response.');
};

// 4. Image Analysis
export const analyzeImage = async (imageFile: File, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const base64Data = await fileToBase64(imageFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: imageFile.type } },
                { text: prompt },
            ],
        },
    });
    return response.text;
};


// 5. Video Generation
async function* pollVeoOperation(operation: any): AsyncGenerator<VeoGenerationState> {
    let currentOperation = operation;
    let progress = 10;
    yield { progress, message: 'Operation started. Waiting for completion...', videoUrl: null, error: null };

    while (!currentOperation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        try {
            const ai = getAiClient();
            currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
            progress = Math.min(progress + 5, 95); // Simulate progress
            yield { progress, message: 'Processing video...', videoUrl: null, error: null };
        } catch (e: any) {
            yield { progress: 100, message: 'Polling failed.', videoUrl: null, error: e.message };
            return;
        }
    }

    const downloadLink = currentOperation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
        // The API key is appended automatically by the environment proxy.
        yield { progress: 100, message: 'Video generated successfully!', videoUrl: `${downloadLink}&key=${process.env.API_KEY}`, error: null };
    } else {
        yield { progress: 100, message: 'Generation failed to produce a video.', videoUrl: null, error: 'No video URI found in response.' };
    }
}

export async function* generateVideoFromText(prompt: string, aspectRatio: '16:9' | '9:16'): AsyncGenerator<VeoGenerationState> {
    const ai = getAiClient();
    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });
    yield* pollVeoOperation(operation);
}

export async function* generateVideoFromImage(prompt: string, imageFile: File, aspectRatio: '16:9' | '9:16'): AsyncGenerator<VeoGenerationState> {
    const ai = getAiClient();
    const base64Data = await fileToBase64(imageFile);
    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: {
            imageBytes: base64Data,
            mimeType: imageFile.type,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });
    yield* pollVeoOperation(operation);
}

// 6. Video Analysis
export const analyzeVideo = async (videoFile: File, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const base64Data = await fileToBase64(videoFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: videoFile.type } },
                { text: prompt },
            ],
        },
    });
    return response.text;
};

// 7. Live Conversation
export interface LiveSession {
  close: () => void;
}
export interface LiveCallbacks {
    onMessage: (message: LiveServerMessage) => void;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
}

export const startLiveConversation = async (callbacks: LiveCallbacks): Promise<LiveSession> => {
    const ai = getAiClient();
    
    let audioStream: MediaStream | null = null;
    let inputAudioContext: AudioContext | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: async () => {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                const source = inputAudioContext.createMediaStreamSource(audioStream);
                scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                
                scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const l = inputData.length;
                    const int16 = new Int16Array(l);
                    for (let i = 0; i < l; i++) {
                        int16[i] = inputData[i] * 32768;
                    }
                    const pcmBlob = {
                        data: encode(new Uint8Array(int16.buffer)),
                        mimeType: 'audio/pcm;rate=16000',
                    };

                    sessionPromise.then((session) => {
                      session.sendRealtimeInput({ media: pcmBlob });
                    }).catch(callbacks.onError);
                };
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputAudioContext.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
                callbacks.onMessage(message);

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContext.destination);
                    source.addEventListener('ended', () => sources.delete(source));
                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(source);
                }
                 if (message.serverContent?.interrupted) {
                    for (const source of sources.values()) {
                      source.stop();
                      sources.delete(source);
                    }
                    nextStartTime = 0;
                  }
            },
            onerror: callbacks.onError,
            onclose: callbacks.onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        },
    });

    const session = await sessionPromise;

    return {
        close: () => {
            scriptProcessor?.disconnect();
            inputAudioContext?.close();
            audioStream?.getTracks().forEach(track => track.stop());
            outputAudioContext.close();
            session.close();
        }
    };
};

// 8. Audio Transcription
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const ai = getAiClient();
    const audioFile = new File([audioBlob], "audio.webm", { type: audioBlob.type });
    const base64Data = await fileToBase64(audioFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType: audioFile.type } },
                { text: 'Transcribe this audio.' },
            ],
        },
    });
    return response.text;
};

// 9. Text-to-Speech
export const generateSpeech = async (text: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        const audioBytes = decode(base64Audio);
        // The TTS model outputs 24kHz, 1-channel, 16-bit PCM audio.
        const wavBlob = pcmToWav(audioBytes, 24000, 1, 16);
        return URL.createObjectURL(wavBlob);
    }
    throw new Error('No audio data received.');
};