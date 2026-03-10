import { AppShell } from "@/components/app-shell"
import { AgentDetail } from "./agent-detail"
import { MOCK_AGENT_DETAIL } from "@/lib/mock-data"
import { notFound } from "next/navigation"

export async function generateStaticParams() {
  return Object.keys(MOCK_AGENT_DETAIL).map((id) => ({ id }))
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = MOCK_AGENT_DETAIL[id]
  if (!agent) notFound()

  return (
    <AppShell>
      <AgentDetail agent={agent} />
    </AppShell>
  )
}
