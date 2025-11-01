
export enum Feature {
  CHAT = 'Chat',
  IMAGE_GEN = 'Image Generation',
  IMAGE_EDIT = 'Image Editing',
  IMAGE_UNDERSTAND = 'Image Analysis',
  VIDEO_GEN = 'Video Generation',
  VIDEO_EDIT = 'Video Editing',
  VIDEO_UNDERSTAND = 'Video Analysis',
  LIVE_CONVERSATION = 'Live Conversation',
  AUDIO_TRANSCRIPTION = 'Audio Transcription',
  TTS = 'Text-to-Speech',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  groundingChunks?: any[];
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunkMap {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets: {
            uri: string;
            text: string;
        }[];
    }[];
}

export interface VeoGenerationState {
  progress: number;
  message: string;
  videoUrl: string | null;
  error: string | null;
}