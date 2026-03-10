import { AppShell } from "@/components/app-shell"
import { RetryQueueView } from "./retry-queue-view"

export default function QueuePage() {
  return (
    <AppShell>
      <RetryQueueView />
    </AppShell>
  )
}
