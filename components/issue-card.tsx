import { AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import type { Issue } from '@/types'
import { truncateUrl } from '@/lib/utils'

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    variant: 'critical' as const,
    iconColor: 'text-red-400',
  },
  medium: {
    icon: AlertTriangle,
    label: 'Medium',
    variant: 'medium' as const,
    iconColor: 'text-yellow-400',
  },
  low: {
    icon: Info,
    label: 'Low',
    variant: 'low' as const,
    iconColor: 'text-blue-400',
  },
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  page_crash: 'Page Crash',
  page_not_found: '404 Not Found',
  navigation_failure: 'Navigation Failure',
  js_error: 'JavaScript Error',
  console_error: 'Console Error',
  network_failure: 'Network Failure',
  missing_image: 'Missing Image',
  broken_form: 'Broken Form',
  slow_load: 'Slow Load',
  console_warning: 'Console Warning',
}

interface IssueCardProps {
  issue: Issue
}

export function IssueCard({ issue }: IssueCardProps) {
  const config = SEVERITY_CONFIG[issue.severity]
  const Icon = config.icon
  const details = issue.details as Record<string, unknown> | null

  const affectedUrl =
    typeof details?.url === 'string' ? details.url : null

  const errorMessages = Array.isArray(details?.errors)
    ? (details.errors as string[])
    : Array.isArray(details?.failures)
    ? (details.failures as string[]).map((f) =>
        typeof f === 'string' ? f : JSON.stringify(f)
      )
    : Array.isArray(details?.images)
    ? (details.images as string[])
    : []

  return (
    <Card className="hover:border-zinc-700 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-medium text-zinc-100">{issue.title}</h4>
              <Badge variant={config.variant} className="shrink-0">
                {config.label}
              </Badge>
            </div>

            {/* Issue type label */}
            <div className="text-xs text-zinc-600 mb-2">
              {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
            </div>

            {/* Description */}
            {issue.description && (
              <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                {issue.description}
              </p>
            )}

            {/* Affected URL */}
            {affectedUrl && (
              <a
                href={affectedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {truncateUrl(affectedUrl, 55)}
              </a>
            )}

            {/* Error details */}
            {errorMessages.length > 0 && (
              <div className="mt-2 space-y-1">
                {errorMessages.slice(0, 3).map((msg, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-500 truncate"
                    title={msg}
                  >
                    {msg}
                  </div>
                ))}
                {errorMessages.length > 3 && (
                  <div className="text-xs text-zinc-600">
                    +{errorMessages.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
