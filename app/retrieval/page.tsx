import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function Home() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          💻💬
          <span className="ml-2">
            This a simple ChatGPT window--use it as you like! Click on ChatPPC above to access the clinic&apos;s ChatBot.
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="api/chat"
      emoji="💬"
      placeholder="Enter any general ChatGPT queries here."
      emptyStateComponent={InfoCard}
    />
  );
}
