import type { ComponentProps } from "react"
import { Archive, Copy, Pause, Pencil, Play, Trash2, Zap, type LucideIcon } from "lucide-react"
import { Badge } from "@/Shadcn-Components/ui/badge"
import { Button } from "@/Shadcn-Components/ui/button"
import { ACTIONS, availableActions, isEditable, type CampaignAction } from "@/admin/campaigns/actions"
import { formatDateTime, formatPeriod } from "@/admin/campaigns/dates"
import { SITUATION_LABELS, TYPE_LABELS, situationOf, type Situation } from "@/admin/campaigns/labels"
import type { CampaignSummary } from "@/admin/campaigns/types"

const ICONS: Record<CampaignAction, LucideIcon> = {
  activate: Zap,
  disable: Pause,
  reactivate: Play,
  duplicate: Copy,
  archive: Archive,
  delete: Trash2,
}

const BADGES: Record<Situation, ComponentProps<typeof Badge>["variant"]> = {
  DRAFT: "outline",
  SCHEDULED: "default",
  ACTIVE: "success",
  EXPIRED: "secondary",
  DISABLED: "secondary",
  ARCHIVED: "secondary",
}

const collections = (count: number) => (count === 1 ? "1 coleção" : `${count} coleções`)

export function CampaignList({
  campaigns,
  disabled,
  onEdit,
  onAction,
}: {
  campaigns: CampaignSummary[]
  /** Enquanto uma ação ou a atualização da lista não termina, as versões na tela podem estar velhas. */
  disabled: boolean
  onEdit: (campaign: CampaignSummary) => void
  onAction: (action: CampaignAction, campaign: CampaignSummary) => void
}) {
  return (
    <ul className="divide-y divide-border">
      {campaigns.map((campaign) => {
        const situation = situationOf(campaign)
        const name = campaign.name ?? "Sem nome"
        return (
          <li
            key={campaign.id}
            data-testid={`campaign-${campaign.id}`}
            className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={`min-w-0 break-words font-medium ${campaign.name ? "" : "text-muted-foreground"}`}>{name}</h2>
                <Badge variant={BADGES[situation]}>{SITUATION_LABELS[situation]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {(campaign.type && TYPE_LABELS[campaign.type]) || "Sem tipo"} · Prioridade {campaign.priority} ·{" "}
                {collections(campaign.collectionCount)}
              </p>
              <p className="text-sm">{formatPeriod(campaign.startsAt, campaign.endsAt)}</p>
              <p className="break-words text-xs text-muted-foreground">
                Atualizada em {formatDateTime(campaign.updatedAt)}
                {campaign.updatedBy && ` por ${campaign.updatedBy}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:max-w-sm md:justify-end">
              {isEditable(campaign) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Editar: ${name}`}
                  onClick={() => onEdit(campaign)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Editar
                </Button>
              )}
              {availableActions(campaign).map((action) => {
                const Icon = ICONS[action]
                return (
                  <Button
                    key={action}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    aria-label={`${ACTIONS[action].label}: ${name}`}
                    onClick={() => onAction(action, campaign)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {ACTIONS[action].label}
                  </Button>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
