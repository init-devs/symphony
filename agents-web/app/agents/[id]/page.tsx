import { AppShell } from "@/components/app-shell"
import { AgentDetail } from "./agent-detail"

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <AppShell>
      <AgentDetail issueIdentifier={id} />
    </AppShell>
  )
}
