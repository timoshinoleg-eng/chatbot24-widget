'use client';

import { ChatWidget } from '@/components/ChatWidget';

export default function WidgetPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md h-[700px] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <ChatWidget />
      </div>
    </div>
  );
}
