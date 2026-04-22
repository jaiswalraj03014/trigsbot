'use client';

import ChatBuilder from './components/ChatBuilder';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FDFCF8] text-[#2D2A26] p-6 flex flex-col items-center">
      {/* Header completely removed for maximum minimalism */}
      <div className="w-full max-w-3xl h-[90vh] flex flex-col pt-12">
        <div className="flex-grow min-h-0">
          <ChatBuilder />
        </div>
      </div>
    </main>
  );
}