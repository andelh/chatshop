import { MessageSquare } from "lucide-react";

export default function StudioV2Page() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center select-none">
      <MessageSquare className="h-8 w-8 text-[#DDDBD8] mb-4" strokeWidth={1.5} />
      <p className="text-[15px] font-semibold text-[#1A1A1A]">
        Select a conversation
      </p>
      <p className="text-[13px] text-[#999] mt-1">
        Choose a thread from the list to view it here
      </p>
    </div>
  );
}
