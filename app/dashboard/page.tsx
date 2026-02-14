'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface Document {
  name: string;
  uploadedAt: string;
  chunks: number;
}

interface Source {
  documentName: string;
  chunk: string;
  relevanceScore: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface StoredFile {
  name: string;
  content: string;
  uploadedAt: string;
}

const SESSIONS_STORAGE_KEY = 'knowledgeqa_sessions';
const CURRENT_SESSION_KEY = 'knowledgeqa_current_session';
const CHAT_STORAGE_KEY = 'knowledgeqa_chat_history';
const FILES_STORAGE_KEY = 'knowledgeqa_files';

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'upload'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get current session's chat history
  const chatHistory = sessions.find(s => s.id === currentSessionId)?.messages || [];

  const setChatHistory = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prevSessions => {
      return prevSessions.map(session => {
        if (session.id === currentSessionId) {
          const newMessages = typeof updater === 'function' 
            ? updater(session.messages) 
            : updater;
          return { ...session, messages: newMessages, updatedAt: Date.now() };
        }
        return session;
      });
    });
  };

  // Load from localStorage
  useEffect(() => {
    // Try to load sessions first, fallback to legacy chat history
    const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const savedCurrentSession = localStorage.getItem(CURRENT_SESSION_KEY);
    
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        if (savedCurrentSession && parsedSessions.find((s: ChatSession) => s.id === savedCurrentSession)) {
          setCurrentSessionId(savedCurrentSession);
        } else if (parsedSessions.length > 0) {
          setCurrentSessionId(parsedSessions[0].id);
        }
      } catch {
        console.error('Failed to parse sessions');
      }
    } else {
      // Migrate legacy chat history to sessions
      const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);
      if (savedChat) {
        try {
          const messages = JSON.parse(savedChat);
          if (messages.length > 0) {
            const newSession: ChatSession = {
              id: Date.now().toString(),
              title: messages[0]?.content?.slice(0, 30) || 'New Chat',
              messages,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            setSessions([newSession]);
            setCurrentSessionId(newSession.id);
          }
        } catch {
          console.error('Failed to parse chat history');
        }
      }
    }
    
    const savedFiles = localStorage.getItem(FILES_STORAGE_KEY);
    if (savedFiles) {
      try {
        setStoredFiles(JSON.parse(savedFiles));
      } catch {
        console.error('Failed to parse stored files');
      }
    }
  }, []);

  // Save sessions
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  // Save current session ID
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
    }
  }, [currentSessionId]);

  // Save stored files
  useEffect(() => {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(storedFiles));
  }, [storedFiles]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setUploadSuccess(null);

    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    if (!file || !file.name) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    try {
      // Store file content in localStorage
      const content = await file.text();
      const newFile: StoredFile = {
        name: file.name,
        content: content.slice(0, 10000), // Store first 10k chars
        uploadedAt: new Date().toISOString(),
      };
      setStoredFiles(prev => {
        const filtered = prev.filter(f => f.name !== file.name);
        return [...filtered, newFile];
      });

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setUploadSuccess(`"${data.documentName}" uploaded`);
      fetchDocuments();
      (e.target as HTMLFormElement).reset();
      const label = document.getElementById('file-label');
      if (label) {
        label.textContent = 'Click to select a file';
        label.className = 'text-gray-500';
      }
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docName: string) => {
    if (deleting) return;
    setDeleting(docName);
    setError(null);

    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentName: docName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Delete failed');
      }
      // Remove from localStorage
      setStoredFiles(prev => prev.filter(f => f.name !== docName));
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleAsk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    // Create a new session if none exists
    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: trimmedQuestion.slice(0, 30) + (trimmedQuestion.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: trimmedQuestion,
      timestamp: Date.now(),
    };
    
    // Update session with user message and title if first message
    setSessions(prevSessions => {
      return prevSessions.map(session => {
        if (session.id === sessionId) {
          const isFirstMessage = session.messages.length === 0;
          return {
            ...session,
            messages: [...session.messages, userMessage],
            title: isFirstMessage ? trimmedQuestion.slice(0, 30) + (trimmedQuestion.length > 30 ? '...' : '') : session.title,
            updatedAt: Date.now(),
          };
        }
        return session;
      });
    });
    
    setQuestion('');
    setAsking(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get answer');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        sources: data.sources,
        timestamp: Date.now(),
      };
      
      setSessions(prevSessions => {
        return prevSessions.map(session => {
          if (session.id === sessionId) {
            return {
              ...session,
              messages: [...session.messages, assistantMessage],
              updatedAt: Date.now(),
            };
          }
          return session;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
    } finally {
      setAsking(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (currentSessionId) {
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));
      const remaining = sessions.filter(s => s.id !== currentSessionId);
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
      } else {
        setCurrentSessionId(null);
      }
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
      } else {
        setCurrentSessionId(null);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() && !asking) {
        handleAsk(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const getUniqueSourceDocs = (sources: Source[]) => {
    return [...new Set(sources.map(s => s.documentName))];
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-gray-100 bg-white z-10">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="text-lg font-semibold text-gray-900">
              Knowledge<span className="text-gray-300">Q&A</span>
            </Link>
          </div>
          <Link
            href="/status"
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
          >
            Status
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } flex-shrink-0 border-r border-gray-100 bg-gray-50/50 transition-all duration-200 overflow-hidden`}
        >
          <div className="w-64 h-full flex flex-col">
            {/* View Toggle */}
            <div className="p-3 border-b border-gray-100">
              <div className="flex bg-white border border-gray-200 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveView('chat')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeView === 'chat'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveView('upload')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeView === 'upload'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Upload
                </button>
              </div>
            </div>

            {/* Sidebar Content - Sessions for Chat, Documents for Upload */}
            <div className="flex-1 overflow-y-auto p-3">
              {activeView === 'chat' ? (
                /* Chat Sessions List */
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Sessions
                    </span>
                    <button
                      onClick={createNewSession}
                      className="p-1 hover:bg-white rounded transition-colors"
                      title="New Chat"
                    >
                      <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-gray-400 mb-3">No chat sessions</p>
                      <button
                        onClick={createNewSession}
                        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Start a chat
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-0.5">
                      {sessions.map((session) => (
                        <li
                          key={session.id}
                          onClick={() => switchSession(session.id)}
                          className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            session.id === currentSessionId
                              ? 'bg-white shadow-sm'
                              : 'hover:bg-white'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="text-xs text-gray-600 truncate flex-1">
                            {session.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                          >
                            <svg className="w-3 h-3 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                /* Documents List */
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Documents
                    </span>
                    <span className="text-xs text-gray-300">{documents.length}</span>
                  </div>
                  {documents.length === 0 ? (
                    <p className="text-xs text-gray-400 py-8 text-center">
                      No documents
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {documents.map((doc) => (
                        <li
                          key={doc.name}
                          className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs text-gray-600 truncate flex-1">
                            {doc.name}
                          </span>
                          <button
                            onClick={() => handleDelete(doc.name)}
                            disabled={deleting === doc.name}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                          >
                            {deleting === doc.name ? (
                              <svg className="w-3 h-3 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            {activeView === 'chat' && currentSessionId && chatHistory.length > 0 && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={clearChat}
                  className="w-full px-2 py-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete session
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {activeView === 'upload' ? (
            /* Upload View */
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-md">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg text-red-600 text-xs">
                    {error}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg text-green-600 text-xs flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {uploadSuccess}
                  </div>
                )}
                <form onSubmit={handleUpload}>
                  <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-gray-300 transition-all cursor-pointer bg-gray-50/50">
                    <input
                      type="file"
                      name="file"
                      id="file"
                      className="hidden"
                      onChange={(e) => {
                        const label = document.getElementById('file-label');
                        if (label && e.target.files?.[0]) {
                          label.textContent = e.target.files[0].name;
                          label.className = 'text-gray-900 text-sm';
                        }
                      }}
                    />
                    <label htmlFor="file" className="cursor-pointer block">
                      <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p id="file-label" className="text-gray-500 text-sm">
                        Click to select a file
                      </p>

                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="mt-4 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Chat View */
            <>
              <div className="flex-1 overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center px-4">
                      <p className="text-gray-300 text-sm">Ask a question about your documents</p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto py-6 px-4">
                    {chatHistory.map((msg) => (
                      <div key={msg.id} className="mb-5">
                        {msg.type === 'user' ? (
                          <div className="flex justify-end">
                            <div className="max-w-[85%] bg-gray-100 px-4 py-2.5 rounded-2xl rounded-br-sm">
                              <p className="text-sm text-gray-800">{msg.content}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="pl-1">
                            <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:p-3 prose-pre:rounded-lg">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {getUniqueSourceDocs(msg.sources).map((docName, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-400 text-xs rounded-md"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {docName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {asking && (
                      <div className="mb-5 pl-1">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex-shrink-0 border-t border-gray-100 bg-white p-4">
                <div className="max-w-2xl mx-auto">
                  {error && (
                    <div className="mb-2 p-2 bg-red-50 rounded-lg text-red-600 text-xs">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleAsk} className="relative">
                    <textarea
                      ref={inputRef}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask a question..."
                      className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-200 focus:bg-white transition-all resize-none"
                      rows={1}
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = '48px';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                      }}
                    />
                    <button
                      type="submit"
                      disabled={asking || !question.trim()}
                      className="absolute right-2 bottom-2 p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
