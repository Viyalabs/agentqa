'use client'

import { useEffect } from 'react'

interface Props { endpoint: string }

/**
 * Fires a fetch to a non-existent API endpoint — seeded issue for AgentQA demo.
 * Simulates AI-generated code that calls internal endpoints that don't exist in production.
 * The failed XHR is intercepted by AgentQA's network monitor and reported as a failed API call.
 */
export function DemoNetworkError({ endpoint }: Props) {
  useEffect(() => {
    void fetch(endpoint).catch(() => {})
  }, [endpoint])
  return null
}
