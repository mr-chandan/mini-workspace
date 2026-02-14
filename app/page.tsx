import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="h-14 border-b border-gray-100">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            Knowledge<span className="text-gray-300">Q&A</span>
          </h1>
          <div className="flex items-center gap-6">
            <Link href="/status" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Status
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Open App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6">
        <section className="py-28 md:py-40 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full text-xs text-gray-500 mb-8">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
            Private & Secure
          </div>
          <h2 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-[1.1] tracking-tight">
            Ask your
            <br />
            <span className="text-gray-300">documents</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-md mx-auto mb-12">
            Upload files, ask questions, get answers with sources. Simple.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all hover:gap-3"
          >
            Get Started
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>

        {/* Features */}
        <section className="py-20 border-t border-gray-100">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Upload</h4>
              <p className="text-gray-400 text-sm">
                PDFs and text files
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Ask</h4>
              <p className="text-gray-400 text-sm">
                Natural language queries
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Answer</h4>
              <p className="text-gray-400 text-sm">
                With source citations
              </p>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-12 border-t border-gray-100">
          <div className="flex flex-wrap justify-center items-center gap-8 text-xs text-gray-300">
            <span>Pinecone</span>
            <span>NVIDIA</span>
            <span>Gemini</span>
            <span>Next.js</span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-gray-300 text-xs">
          Knowledge Q&A
        </div>
      </footer>
    </div>
  );
}
