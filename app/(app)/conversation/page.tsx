import { Container } from "@/components/ui/container";
import { ConversationApp } from "@/components/conversation/conversation-app";

export const metadata = { title: "Conversation" };

export default function ConversationPage() {
  return (
    <Container className="py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Conversation practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice real scenarios with an AI conversation partner — by text or voice.
        </p>
      </div>

      <ConversationApp />
    </Container>
  );
}
