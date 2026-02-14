'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HealthStatus {
  status: string;
  services: {
    backend: boolean;
    database: boolean;
    embeddings: boolean;
    llm: boolean;
  };
  timestamp: string;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const StatusBadge = ({ ok }: { ok: boolean }) => (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        ok ? 'text-green-500' : 'text-red-500'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}></span>
      {ok ? 'Healthy' : 'Unhealthy'}
    </span>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="h-14 border-b border-gray-100">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-900">
            Knowledge<span className="text-gray-300">Q&A</span>
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Open App
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">System Status</h1>
        <p className="text-sm text-gray-400 mb-8">
          Service health overview
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-300 text-sm">
              Checking...
            </div>
          ) : health ? (
            <>
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-900">
                  Overall
                </span>
                <span
                  className={`text-sm font-semibold ${
                    health.status === 'healthy'
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {health.status === 'healthy' ? 'All Systems Go' : 'Issues Detected'}
                </span>
              </div>

              <div className="divide-y divide-gray-50">
                <div className="flex justify-between items-center p-4">
                  <div>
                    <span className="text-sm text-gray-700">Backend</span>
                    <p className="text-xs text-gray-300">Next.js API</p>
                  </div>
                  <StatusBadge ok={health.services.backend} />
                </div>

                <div className="flex justify-between items-center p-4">
                  <div>
                    <span className="text-sm text-gray-700">Database</span>
                    <p className="text-xs text-gray-300">Pinecone</p>
                  </div>
                  <StatusBadge ok={health.services.database} />
                </div>

                <div className="flex justify-between items-center p-4">
                  <div>
                    <span className="text-sm text-gray-700">Embeddings</span>
                    <p className="text-xs text-gray-300">NVIDIA</p>
                  </div>
                  <StatusBadge ok={health.services.embeddings} />
                </div>

                <div className="flex justify-between items-center p-4">
                  <div>
                    <span className="text-sm text-gray-700">LLM</span>
                    <p className="text-xs text-gray-300">Gemini</p>
                  </div>
                  <StatusBadge ok={health.services.llm} />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 text-xs text-gray-300">
                {new Date(health.timestamp).toLocaleString()}
              </div>
            </>
          ) : null}
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="mt-4 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </main>
    </div>
  );
}
