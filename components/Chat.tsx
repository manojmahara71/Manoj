import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GroundingChunkWeb, GroundingChunkMap } from '../types';
import { generateChatResponseStream } from '../services/geminiService';

type ChatMode = 'lite' | 'flash' | 'pro';
type GroundingMode = 'none' | 'search' | 'maps' | 'auto';

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState<ChatMode>('lite');
    const [groundingMode, setGroundingMode] = useState<GroundingMode>('auto');
    const [groundingFeedback, setGroundingFeedback] = useState<Record<string, 'up' | 'down'>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage, { role: 'model', text: '' }]);
        setInput('');
        setIsLoading(true);

        try {
            const stream = generateChatResponseStream(input, chatMode, groundingMode);
            let finalGroundingChunks: any[] | undefined = undefined;

            for await (const chunk of stream) {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (chunk.text) {
                       lastMessage.text += chunk.text;
                    }
                    if (chunk.groundingChunks) {
                         finalGroundingChunks = chunk.groundingChunks;
                    }
                    return newMessages;
                });
            }
            
            if (finalGroundingChunks) {
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].groundingChunks = finalGroundingChunks;
                    return newMessages;
                });
            }

        } catch (error: any) {
            console.error("Error generating chat response:", error);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                lastMessage.text = `Sorry, I encountered an error: ${error.message}`;
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVote = (uri: string, vote: 'up' | 'down') => {
        setGroundingFeedback(prev => {
            const newFeedback = {...prev};
            if (newFeedback[uri] === vote) {
                delete newFeedback[uri]; // Un-vote if clicking the same button again
            } else {
                newFeedback[uri] = vote;
            }
            return newFeedback;
        });
        // In a real application, you would send this feedback to a server.
    };

    const renderGroundingInfo = (chunks: any[] | undefined) => {
        if (!chunks || chunks.length === 0) return null;

        const renderChunk = (chunkData: GroundingChunkWeb | GroundingChunkMap, index: number) => {
            const vote = groundingFeedback[chunkData.uri];
            return (
                 <li key={index} className="flex items-center justify-between gap-2">
                    <a href={chunkData.uri} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline truncate" title={chunkData.title}>
                        {chunkData.title}
                    </a>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => handleVote(chunkData.uri, 'up')} className={`p-0.5 rounded-full transition-colors ${vote === 'up' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:bg-gray-600'}`} aria-label="Upvote source">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 18.331v-5.447l2.8-4.223A2 2 0 0112.131 7h1.869a2 2 0 012 2v1zM4 10v11" /></svg>
                        </button>
                        <button onClick={() => handleVote(chunkData.uri, 'down')} className={`p-0.5 rounded-full transition-colors ${vote === 'down' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:bg-gray-600'}`} aria-label="Downvote source">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.738 3h4.017c.163 0 .326.02.485.06L17 5.669v5.447l-2.8 4.223A2 2 0 0111.869 17h-1.87a2 2 0 01-2-2v-1zM20 14V3" /></svg>
                        </button>
                    </div>
                </li>
            );
        };
        
        return (
            <div className="mt-2 border-t border-gray-600 pt-2">
                <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                <ul className="text-xs space-y-1">
                    {chunks.map((chunk, index) => {
                        if (chunk.web) {
                           return renderChunk(chunk.web, index);
                        }
                        if (chunk.maps) {
                             return renderChunk(chunk.maps, index);
                        }
                        return null;
                    })}
                </ul>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-800">
            <header className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold font-orbitron">Meow Chat Ani</h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2">
                    <div className="flex items-center">
                        <label className="text-sm text-gray-400 mr-2">Model:</label>
                        <select value={chatMode} onChange={e => setChatMode(e.target.value as ChatMode)} className="bg-gray-700 rounded p-1 text-sm">
                            <option value="lite">Lite (Fastest)</option>
                            <option value="flash">Flash (Balanced)</option>
                            <option value="pro">Pro (Complex)</option>
                        </select>
                    </div>
                     <div className="flex items-center">
                        <label className="text-sm text-gray-400 mr-2">Grounding:</label>
                        <select value={groundingMode} onChange={e => setGroundingMode(e.target.value as GroundingMode)} className="bg-gray-700 rounded p-1 text-sm">
                            <option value="auto">Auto</option>
                            <option value="none">None</option>
                            <option value="search">Google Search</option>
                            <option value="maps">Google Maps</option>
                        </select>
                    </div>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, index) => {
                    const isLastModelMessage = msg.role === 'model' && index === messages.length - 1;
                    return (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-purple-600' : 'bg-gray-700'}`}>
                                {isLoading && isLastModelMessage && msg.text === '' ? (
                                    <div className="flex items-center space-x-1.5 p-1">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">
                                        {msg.text}
                                        {isLoading && isLastModelMessage && <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse"></span>}
                                    </p>
                                )}
                                {msg.role === 'model' && renderGroundingInfo(msg.groundingChunks)}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center bg-gray-700 rounded-lg p-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask anything..."
                        className="flex-1 bg-transparent focus:outline-none px-2"
                        disabled={isLoading}
                    />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-2 bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;