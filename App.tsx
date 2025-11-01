import React, { useState, useMemo } from 'react';
import { Feature } from './types';
import Chat from './components/Chat';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import ImageAnalyzer from './components/ImageAnalyzer';
import VideoGenerator from './components/VideoGenerator';
import VideoEditor from './components/VideoEditor';
import VideoAnalyzer from './components/VideoAnalyzer';
import LiveConversation from './components/LiveConversation';
import AudioTranscriber from './components/AudioTranscriber';
import TextToSpeech from './components/TextToSpeech';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>(Feature.CHAT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const icons: Record<Feature, React.ReactNode> = {
    [Feature.CHAT]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    [Feature.IMAGE_GEN]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    [Feature.IMAGE_EDIT]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>,
    [Feature.IMAGE_UNDERSTAND]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>,
    [Feature.VIDEO_GEN]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    [Feature.VIDEO_EDIT]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h3.5m5.5 0H15m-10-8h10a2 2 0 012 2v3.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h11a2 2 0 012 2v1" /><path strokeLinecap="round" strokeLinejoin="round" d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /></svg>,
    [Feature.VIDEO_UNDERSTAND]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
    [Feature.LIVE_CONVERSATION]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
    [Feature.AUDIO_TRANSCRIPTION]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    [Feature.TTS]: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.858 5.858a3 3 0 104.243 4.243L5.858 14.343m0-8.485A3 3 0 0110.1 10.1m-4.242 4.243L10.1 10.1" /></svg>,
  };

  const renderActiveFeature = useMemo(() => {
    switch (activeFeature) {
      case Feature.CHAT: return <Chat />;
      case Feature.IMAGE_GEN: return <ImageGenerator />;
      case Feature.IMAGE_EDIT: return <ImageEditor />;
      case Feature.IMAGE_UNDERSTAND: return <ImageAnalyzer />;
      case Feature.VIDEO_GEN: return <VideoGenerator />;
      case Feature.VIDEO_EDIT: return <VideoEditor />;
      case Feature.VIDEO_UNDERSTAND: return <VideoAnalyzer />;
      case Feature.LIVE_CONVERSATION: return <LiveConversation />;
      case Feature.AUDIO_TRANSCRIPTION: return <AudioTranscriber />;
      case Feature.TTS: return <TextToSpeech />;
      default: return <Chat />;
    }
  }, [activeFeature]);

  const handleFeatureSelect = (feature: Feature) => {
    setActiveFeature(feature);
    setIsSidebarOpen(false); // Close sidebar on selection
  };
  
  const Logo = () => (
     <svg className="w-10 h-10 text-purple-400" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M3.75 9.227C3.75 5.863 6.49 3.25 9.814 3.25H14.186C17.51 3.25 20.25 5.863 20.25 9.227V13.5C20.25 17.5 17.19 20.75 13.125 20.75H10.875C6.81 20.75 3.75 17.5 3.75 13.5V9.227ZM9.75 12.125C9.75 11.428 10.328 10.875 11.025 10.875H12.975C13.672 10.875 14.25 11.428 14.25 12.125C14.25 12.822 13.672 13.375 12.975 13.375H11.025C10.328 13.375 9.75 12.822 9.75 12.125ZM8.625 7.75C8.625 7.19772 9.07272 6.75 9.625 6.75H9.875C10.4273 6.75 10.875 7.19772 10.875 7.75V8C10.875 8.55228 10.4273 9 9.875 9H9.625C9.07272 9 8.625 8.55228 8.625 8V7.75ZM13.125 7.75C13.125 7.19772 13.5727 6.75 14.125 6.75H14.375C14.9273 6.75 15.375 7.19772 15.375 7.75V8C15.375 8.55228 14.9273 9 14.375 9H14.125C13.5727 9 13.125 8.55228 13.125 8V7.75Z"/>
    </svg>
  );

  const SidebarContent = () => (
    <>
      <div className="mb-8 flex items-center gap-3">
        <Logo />
        <h1 className="text-xl font-bold font-orbitron">MEOW</h1>
      </div>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 md:hidden">AI Features</h2>
      <ul className="space-y-2">
        {Object.values(Feature).map((feature) => (
          <li key={feature}>
            <button
              onClick={() => handleFeatureSelect(feature)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                activeFeature === feature
                  ? 'bg-purple-600/30 text-white'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {icons[feature]}
              <span>{feature}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-4 border-t border-gray-700/50">
        <p className="text-xs text-gray-500 text-center">
          &copy; {new Date().getFullYear()} Manish<br/>
          <a href="https://manojmahara.com.np" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400">
            manojmahara.com.np
          </a>
        </p>
      </div>
    </>
  );

  return (
    <div className="relative md:flex h-screen bg-gray-900 text-gray-100 font-poppins overflow-hidden">
      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 border-r border-gray-700/50 p-4 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:flex`}>
        <SidebarContent />
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700/50">
           <div className="flex items-center gap-3">
             <Logo />
             <h1 className="text-xl font-bold font-orbitron">MEOW</h1>
           </div>
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-300 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
           </button>
        </header>
        {renderActiveFeature}
      </main>
    </div>
  );
};

export default App;