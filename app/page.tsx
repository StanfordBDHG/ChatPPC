import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="hidden text-2xl md:block">
          👋
          <span className="ml-2 text-xl">
            Welcome! This is a tool to help staff at Gardner Packard Children&apos;s Health Center navigate patient care resources. All information is sourced from {" "}
            <a href="https://med.stanford.edu/ppc.html" target="_blank">
              ppc.stanford.edu
            </a>{"."}

          </span>
        </li>
      </ul>

      <ul>
        <li className="hidden text-2xl md:block">
          🛑
            <span className="ml-2 text-xl">
            Please <u><strong>DO NOT include PHI</strong></u> in any of your searches.
            </span>
        </li>
      </ul>

    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="api/chat/retrieval"
      emptyStateComponent={InfoCard}
      showIngestForm={false}
      placeholder={
        'Enter your question here! (Do NOT include PHI)'
      }
      emoji="💡"
    />
  );
}
