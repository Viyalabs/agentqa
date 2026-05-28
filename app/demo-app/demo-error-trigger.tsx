'use client'

import { useEffect } from 'react'

/**
 * Deliberately triggers an uncaught TypeError after page load — seeded issue for AgentQA demo.
 * Simulates the most common AI-generated bug: accessing a property on an
 * unresolved auth context before the session hydrates.
 */
export function DemoErrorTrigger() {
  useEffect(() => {
    window.setTimeout(() => {
      const session = undefined as unknown as { user: { id: string; name: string; plan: string } }
      // This throws: TypeError: Cannot read properties of undefined (reading 'user')
      void session.user.id
    }, 1500)
  }, [])

  return null
}
