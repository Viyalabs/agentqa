# AgentQA — Project Brain

## Product
AgentQA is an AI QA engineer that replaces manual QA testing.

Users paste a URL → system scans app → detects issues → (future) explains + fixes.

## Current Status
Phase 1: COMPLETE
- multi-page crawl (Playwright)
- issue detection (404, JS, network, mobile)
- screenshots
- logs
- shareable reports
- CI webhook
- rate limiting
- queue control

## Phase 2 (IN PROGRESS)
- AI issue summaries
- root cause detection
- fix recommendations

## Phase 3 (PLANNED)
- auth flow testing
- user journey testing

## Phase 4 (PLANNED)
- CI/CD integrations
- regression tracking

## Phase 5 (PLANNED)
- repo scanning (sandbox)

## Phase 6 (VISION)
- auto-fix agent (PR generation)

## Key Constraints
- scans must complete < 2 minutes
- do not break crawler stability
- avoid heavy infra costs
- maintain simple UX

## Moat Strategy
- collect bug dataset
- build AI reasoning layer
- learn from scan patterns
- evolve into auto-fix agent

## Current Weakness
- no visible AI intelligence yet
- low user traction
- no strong testimonials

## Goal
Become default AI QA platform for AI-generated apps.