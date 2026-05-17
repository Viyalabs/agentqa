/**
 * Known failure signatures — pre-seeded library of well-known framework bugs.
 *
 * Each signature is matched against incoming issues via keyword/regex first
 * (fast, no external calls), then optionally by semantic similarity if
 * embeddings are available.
 *
 * When a signature matches, its root_cause and fix_suggestion replace the
 * Claude AI analysis step — saving tokens and delivering instant, battle-tested
 * diagnoses for patterns that are already fully understood.
 *
 * Call seedKnownSignatures() once to persist these to the failure_signatures DB
 * table. The function is idempotent (ON CONFLICT DO NOTHING).
 */

import { getAdminClient } from '@/lib/supabase'
import { generateBatchEmbeddings } from './embedding-service'

export interface KnownSignature {
  id:              string           // stable slug, primary key in DB
  framework:       string           // 'nextjs' | 'react' | 'shopify' | 'any' …
  name:            string
  description:     string
  issueType:       string
  severity:        'critical' | 'medium' | 'low'
  triggerPatterns: string[]         // regex strings; tested against title + description
  rootCause:       string
  fixSuggestion:   string
  docsUrl:         string | null
}

// ── Signature library ─────────────────────────────────────────────────────────

export const KNOWN_SIGNATURES: KnownSignature[] = [

  // ── Next.js ────────────────────────────────────────────────────────────────

  {
    id:          'nextjs-hydration-mismatch',
    framework:   'nextjs',
    name:        'Hydration Mismatch',
    description: 'Server-rendered HTML does not match what React renders on the client.',
    issueType:   'js_error',
    severity:    'medium',
    triggerPatterns: [
      'hydration failed',
      'hydration.*mismatch',
      'did not match',
      'server rendered html',
      'Expected server HTML to contain',
      'did not expect server HTML',
      'Text content did not match',
      'Warning: Text content does not match',
    ],
    rootCause:     'Server and client render different HTML — typically caused by Date.now(), Math.random(), browser-only APIs (window/document), or CSS-in-JS class ordering differences in SSR.',
    fixSuggestion: 'Move browser-only code into useEffect. Wrap dynamic values in suppressHydrationWarning or use the "use client" directive. Avoid rendering user-agent or locale-specific content without a stable server default.',
    docsUrl:       'https://nextjs.org/docs/messages/react-hydration-error',
  },

  {
    id:          'nextjs-chunk-load-error',
    framework:   'nextjs',
    name:        'ChunkLoadError — Deployment Skew',
    description: 'Browser fails to fetch a JS chunk that no longer exists on the CDN after a new deployment.',
    issueType:   'js_error',
    severity:    'critical',
    triggerPatterns: [
      'ChunkLoadError',
      'Loading chunk.*failed',
      'Loading CSS chunk.*failed',
      '_next/static/chunks',
      'webpack.*chunk.*error',
      'SyntaxError.*Unexpected token.*<',
    ],
    rootCause:     'Deployment skew: the user\'s browser loaded JS entry points from deployment N, which reference chunk hashes from deployment N. When deployment N+1 replaces those chunks on Vercel/CDN, fetching the old hashes returns 404.',
    fixSuggestion: 'Add a global ChunkLoadError handler: listen to router.events "routeChangeError" and reload. Implement Error Boundary that catches ChunkLoadError and calls window.location.reload(). Consider setting `output: "standalone"` and enabling ISR to reduce deployment windows.',
    docsUrl:       'https://nextjs.org/docs/app/api-reference/next-config-js/output',
  },

  {
    id:          'nextjs-image-domain',
    framework:   'nextjs',
    name:        'next/image — Domain Not Configured',
    description: 'next/image received an image URL whose hostname is not in the allowed list.',
    issueType:   'missing_image',
    severity:    'medium',
    triggerPatterns: [
      'Invalid src prop',
      'hostname.*not configured',
      'remotePatterns',
      '_next/image.*400',
      'is not configured under images',
    ],
    rootCause:     'The image source domain is not listed in images.remotePatterns (Next.js 13+) or images.domains (older). The Image Optimization API returns 400 and the image fails to load.',
    fixSuggestion: 'Add the domain to next.config.js: `images: { remotePatterns: [{ protocol: "https", hostname: "example.com" }] }`. For wildcard subdomains use `hostname: "*.example.com"`.',
    docsUrl:       'https://nextjs.org/docs/messages/next-image-unconfigured-host',
  },

  {
    id:          'nextjs-missing-suspense-boundary',
    framework:   'nextjs',
    name:        'useSearchParams() Missing Suspense Boundary',
    description: 'Next.js 13+ App Router requires useSearchParams() to be wrapped in a Suspense boundary.',
    issueType:   'js_error',
    severity:    'medium',
    triggerPatterns: [
      'useSearchParams.*Suspense',
      'missing.*Suspense',
      'wrapped.*Suspense',
      'Missing Suspense boundary',
      'useSearchParams() should be wrapped',
    ],
    rootCause:     'In the App Router, useSearchParams() opts the entire route into client-side rendering. Next.js requires a <Suspense> boundary to isolate this so the rest of the page can still be statically rendered.',
    fixSuggestion: 'Wrap the component that calls useSearchParams() in `<Suspense fallback={<Loading />}>`, or move the hook into a dedicated client component that is itself wrapped in Suspense.',
    docsUrl:       'https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout',
  },

  {
    id:          'nextjs-env-var-undefined',
    framework:   'nextjs',
    name:        'Missing NEXT_PUBLIC_ Env Variable',
    description: 'A client-side environment variable is undefined because it lacks the NEXT_PUBLIC_ prefix or was not added to the deployment.',
    issueType:   'js_error',
    severity:    'medium',
    triggerPatterns: [
      'process\\.env\\.[A-Z_]+.*undefined',
      'NEXT_PUBLIC.*undefined',
      'Cannot read properties.*undefined.*env',
      'process is not defined',
    ],
    rootCause:     'Environment variables accessed in browser bundles must be prefixed with NEXT_PUBLIC_. Without the prefix Next.js strips them at build time. Also check the variable is set in the deployment environment.',
    fixSuggestion: 'Rename to NEXT_PUBLIC_MY_VAR. Add it to .env.local for development and to Vercel/CI environment variables for production. Rebuild after adding — env vars are inlined at build time.',
    docsUrl:       'https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables',
  },

  {
    id:          'nextjs-api-timeout',
    framework:   'nextjs',
    name:        'API Route / Server Action Timeout',
    description: 'Vercel serverless function exceeded the maximum execution duration.',
    issueType:   'network_failure',
    severity:    'critical',
    triggerPatterns: [
      'FUNCTION_INVOCATION_TIMEOUT',
      '504.*gateway',
      'maxDuration.*exceeded',
      'function.*timed out',
      'Request timeout',
    ],
    rootCause:     'The Vercel serverless function exceeded 10 s (Hobby) or the configured maxDuration. Common causes: synchronous DB queries without connection pooling, large file processing, or missing await on async calls.',
    fixSuggestion: 'Add `export const maxDuration = 60` to the route file (Pro/Enterprise). Move heavy work to background jobs (Vercel Cron, Inngest, QStash). Use connection pooling (Supabase Pooler, PgBouncer) for DB calls.',
    docsUrl:       'https://vercel.com/docs/functions/configuring-functions/duration',
  },

  // ── React ──────────────────────────────────────────────────────────────────

  {
    id:          'react-infinite-render-loop',
    framework:   'react',
    name:        'Infinite Render Loop',
    description: 'setState called during render or in a useEffect with a dependency that changes on every render.',
    issueType:   'js_error',
    severity:    'critical',
    triggerPatterns: [
      'Maximum update depth exceeded',
      'Too many re-renders',
      'too many re-renders',
      'setState.*render',
      'infinite loop',
    ],
    rootCause:     'setState is called during the render phase (directly in the component body), or a useEffect calls setState but its dependency array includes an object/array that gets a new reference on every render.',
    fixSuggestion: 'Move setState calls into event handlers. For useEffect, memoize objects in dependency arrays with useMemo/useCallback, or use primitive values. Add ESLint rule react-hooks/exhaustive-deps to catch these.',
    docsUrl:       'https://react.dev/reference/react/Component#setstate',
  },

  {
    id:          'react-update-unmounted',
    framework:   'react',
    name:        "State Update on Unmounted Component",
    description: 'An async callback completes after the component has unmounted and attempts a state update.',
    issueType:   'console_warning',
    severity:    'low',
    triggerPatterns: [
      "Can't perform a React state update on an unmounted component",
      "Warning: Can't perform",
      'state update on.*unmounted',
      'unmounted component.*setState',
    ],
    rootCause:     'An async operation (fetch, setTimeout, subscription) completes after the component that started it has been removed from the DOM. React 18 silenced this warning but the underlying memory leak persists.',
    fixSuggestion: 'Add a cleanup flag: `let active = true; return () => { active = false }` in the useEffect cleanup. Check `if (active) setState(...)` before updating. Use AbortController for fetch requests.',
    docsUrl:       'https://react.dev/learn/synchronizing-with-effects#fetching-data',
  },

  {
    id:          'react-missing-key-prop',
    framework:   'react',
    name:        'Missing key Prop in List',
    description: 'React list items rendered without stable key props, causing reconciliation inefficiency.',
    issueType:   'console_warning',
    severity:    'low',
    triggerPatterns: [
      'Each child in a list should have a unique.*key',
      'Missing.*key.*prop',
      'key.*prop.*list',
      'unique.*key.*prop',
    ],
    rootCause:     'Array.map() renders components without a key prop, or uses the array index as key with a list that can be reordered. React cannot efficiently reconcile the list on updates.',
    fixSuggestion: 'Add a stable, unique key to each list item (prefer entity ID over index). Never use Math.random() as a key — it defeats memoization. For fixed lists without reorder, index is acceptable.',
    docsUrl:       'https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key',
  },

  {
    id:          'react-use-layout-effect-ssr',
    framework:   'react',
    name:        'useLayoutEffect in SSR',
    description: 'useLayoutEffect used in a component that is server-rendered — it is a no-op on the server.',
    issueType:   'console_warning',
    severity:    'low',
    triggerPatterns: [
      'useLayoutEffect does nothing on the server',
      'useLayoutEffect.*SSR',
      'useLayoutEffect.*server',
    ],
    rootCause:     'useLayoutEffect runs synchronously after DOM paint and cannot run on the server. Using it in SSR contexts produces warnings and potential hydration mismatches.',
    fixSuggestion: 'Replace with useEffect for non-DOM operations. For DOM measurements that must run synchronously, gate with `typeof window !== "undefined"` or use the isomorphic pattern: `const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect`.',
    docsUrl:       'https://react.dev/reference/react/useLayoutEffect',
  },

  // ── Shopify ────────────────────────────────────────────────────────────────

  {
    id:          'shopify-cdn-connection-reset',
    framework:   'shopify',
    name:        'Shopify CDN Connection Reset',
    description: 'Network requests to cdn.shopify.com fail with ECONNRESET or ERR_CONNECTION_RESET.',
    issueType:   'network_failure',
    severity:    'medium',
    triggerPatterns: [
      'cdn\\.shopify\\.com.*ERR_CONNECTION',
      'cdn\\.shopify.*ECONNRESET',
      'cdn\\.shopifycloud\\.com.*failed',
      'shopify.*cdn.*connection',
    ],
    rootCause:     'The Shopify CDN connection is reset mid-transfer, often during traffic spikes, CDN failover events, or when the requesting server\'s IP is throttled by Shopify\'s edge network.',
    fixSuggestion: 'Add `<link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="anonymous">` in theme layout. Implement asset loading retries. For critical assets, self-host via Shopify Files or use a secondary CDN origin.',
    docsUrl:       'https://shopify.dev/docs/themes/best-practices/performance',
  },

  {
    id:          'shopify-liquid-timeout',
    framework:   'shopify',
    name:        'Liquid Render Timeout',
    description: 'Shopify returns 503/524 due to Liquid template render taking too long.',
    issueType:   'page_crash',
    severity:    'critical',
    triggerPatterns: [
      'liquid.*timeout',
      '524.*shopify',
      '503.*shopify',
      'Liquid.*render.*timeout',
      'Request.*timeout.*liquid',
    ],
    rootCause:     'Complex Liquid templates with unbounded loops ({% for product in collection.products %}), sync app blocks with slow external API calls, or excessive metafield lookups exceed Shopify\'s render timeout.',
    fixSuggestion: 'Paginate large Liquid loops. Move non-critical data fetching to Section Rendering API (async). Audit app blocks for slow third-party API calls. Use Shopify Speed Score and Theme Inspector to identify slow sections.',
    docsUrl:       'https://shopify.dev/docs/themes/best-practices/performance/liquid',
  },

  {
    id:          'shopify-cart-api-error',
    framework:   'shopify',
    name:        'Shopify Cart API Failure',
    description: 'Requests to /cart.js, /cart/add.js, or /cart/update.js fail or return unexpected responses.',
    issueType:   'network_failure',
    severity:    'critical',
    triggerPatterns: [
      'cart\\.js.*failed',
      'cart/add\\.js',
      'cart/update\\.js',
      'add to cart.*error',
      'cart.*422',
    ],
    rootCause:     'Cart API requests fail due to variant ID mismatches, sold-out inventory enforcement, missing required properties, or deprecated API endpoints in newer Shopify API versions.',
    fixSuggestion: 'Check variant availability before add-to-cart. Use `available_for_sale` from Storefront API. Migrate to Storefront API Cart endpoints if using headless. Validate `selling_plan_id` for subscription products.',
    docsUrl:       'https://shopify.dev/docs/api/ajax/reference/cart',
  },

  // ── Laravel ────────────────────────────────────────────────────────────────

  {
    id:          'laravel-csrf-419',
    framework:   'laravel',
    name:        'CSRF Token Mismatch — 419',
    description: 'Laravel rejects a form submission or AJAX request with 419 PAGE EXPIRED.',
    issueType:   'network_failure',
    severity:    'critical',
    triggerPatterns: [
      '419',
      'CSRF.*token',
      'csrf.*mismatch',
      'TokenMismatchException',
      'csrf_token.*invalid',
      'PAGE EXPIRED',
    ],
    rootCause:     'Session expired before form submission (default 120 min), or the CSRF token was not included in an AJAX request. Common in SPAs that don\'t refresh the Xsrf-Token cookie, or when session.lifetime is too short.',
    fixSuggestion: 'For Blade: ensure @csrf is in every form. For Axios: configure `axios.defaults.headers.common["X-CSRF-TOKEN"] = document.querySelector("meta[name=csrf-token]")?.content`. For SPAs: use Laravel Sanctum with cookie-based auth. Increase session.lifetime in config/session.php.',
    docsUrl:       'https://laravel.com/docs/csrf',
  },

  {
    id:          'laravel-missing-app-key',
    framework:   'laravel',
    name:        'Missing Application Encryption Key',
    description: 'Laravel throws a RuntimeException because APP_KEY is not set in production.',
    issueType:   'page_crash',
    severity:    'critical',
    triggerPatterns: [
      'No application encryption key',
      'APP_KEY.*not set',
      '\\.env.*not found',
      'RuntimeException.*key',
      'Encryption.*key.*missing',
    ],
    rootCause:     'The APP_KEY environment variable is missing in production. Laravel requires it for session encryption, cookies, and various security mechanisms.',
    fixSuggestion: 'Run `php artisan key:generate` locally and copy the generated key to your deployment environment variables. Never share APP_KEY between environments. Verify APP_KEY is set in CI/CD pipelines before deployment.',
    docsUrl:       'https://laravel.com/docs/encryption',
  },

  {
    id:          'laravel-queue-connection',
    framework:   'laravel',
    name:        'Queue Connection Failed',
    description: 'Laravel queue worker loses connection to Redis or database, causing job processing to stall.',
    issueType:   'network_failure',
    severity:    'medium',
    triggerPatterns: [
      'Connection refused.*redis',
      'queue.*failed.*connect',
      'PhpRedis.*connect',
      'Predis.*connection',
      'queue.*driver.*unavailable',
    ],
    rootCause:     'Redis or database connection dropped — often due to idle connection timeouts, Redis memory limits, or network instability between app server and queue backend.',
    fixSuggestion: 'Set `REDIS_TIMEOUT` and `REDIS_READ_TIMEOUT` env vars. Configure Laravel Horizon with automatic queue restart. Set `retry_after` to prevent job duplication on retry. Use persistent connections (phpredis) for stability.',
    docsUrl:       'https://laravel.com/docs/queues',
  },

  // ── Vercel ─────────────────────────────────────────────────────────────────

  {
    id:          'vercel-edge-runtime-too-large',
    framework:   'vercel',
    name:        'Edge Runtime Bundle Too Large',
    description: 'Edge function or middleware exceeds Vercel\'s 1 MB compressed bundle size limit.',
    issueType:   'page_crash',
    severity:    'critical',
    triggerPatterns: [
      'edge.*bundle.*too large',
      'Edge Runtime.*size.*exceed',
      'middleware.*too large',
      'The Edge Runtime does not support',
      'bundle.*1mb',
    ],
    rootCause:     'The edge function imports a Node.js-only module (crypto, fs, net) or a heavy library that cannot be tree-shaken to fit within the 1 MB edge limit. Edge runtime intentionally excludes Node built-ins.',
    fixSuggestion: 'Move the route from `runtime = "edge"` to `runtime = "nodejs"` if you need Node APIs. Audit imports with `@next/bundle-analyzer`. Replace `crypto` with Web Crypto API (`globalThis.crypto.subtle`). Split heavy logic into separate API routes.',
    docsUrl:       'https://vercel.com/docs/functions/edge-middleware/middleware-api#unsupported-modules',
  },

  {
    id:          'vercel-isr-cache-miss',
    framework:   'vercel',
    name:        'ISR Stale Cache / Cache MISS Loop',
    description: 'Incremental Static Regeneration pages never cache properly, causing every request to revalidate.',
    issueType:   'slow_load',
    severity:    'medium',
    triggerPatterns: [
      'x-vercel-cache.*MISS',
      'stale-while-revalidate.*miss',
      'ISR.*cache',
      'revalidate.*every request',
      'cache-control.*no-cache.*ISR',
    ],
    rootCause:     'ISR cache misses loop when: revalidate is 0 (disables caching), cookies/auth headers bypass CDN cache, or the origin returns no-store/no-cache response headers that override ISR behavior.',
    fixSuggestion: 'Set `revalidate > 0` in generateStaticParams. Ensure authenticated routes use `unstable_cache` or separate data-fetching from layout. Check origin Cache-Control headers — they must not include no-store. Use Vercel Cache API for fine-grained control.',
    docsUrl:       'https://nextjs.org/docs/app/building-your-application/caching',
  },

  // ── WordPress ──────────────────────────────────────────────────────────────

  {
    id:          'wordpress-jquery-not-defined',
    framework:   'wordpress',
    name:        'jQuery / $ Not Defined',
    description: 'A WordPress plugin or theme script references $ or jQuery before it is loaded.',
    issueType:   'js_error',
    severity:    'critical',
    triggerPatterns: [
      '\\$ is not defined',
      'jQuery is not defined',
      'ReferenceError.*\\$',
      '\\$ is not a function',
      'jQuery.*not.*function',
    ],
    rootCause:     'The script\'s wp_enqueue_script() call doesn\'t declare "jquery" as a dependency, or uses $ in no-conflict mode without the jQuery wrapper. WordPress loads jQuery in noConflict mode — $ is not global by default.',
    fixSuggestion: 'Add "jquery" to the deps array in wp_enqueue_script(). Wrap all custom code in `jQuery(document).ready(function($) { ... })` to get the $ alias safely. Avoid inline <script> tags that bypass the dependency queue.',
    docsUrl:       'https://developer.wordpress.org/reference/functions/wp_enqueue_script/',
  },

  {
    id:          'wordpress-admin-ajax-504',
    framework:   'wordpress',
    name:        'admin-ajax.php Gateway Timeout',
    description: 'Requests to wp-admin/admin-ajax.php return 504 due to slow PHP execution.',
    issueType:   'network_failure',
    severity:    'critical',
    triggerPatterns: [
      'admin-ajax\\.php.*504',
      'admin-ajax.*timeout',
      'admin-ajax.*slow',
      'wp-admin/admin-ajax',
    ],
    rootCause:     'An unbounded WP AJAX handler performs slow database queries, external HTTP requests, or full post loops without caching. admin-ajax.php bootstraps the entire WordPress stack, making it expensive.',
    fixSuggestion: 'Cache expensive AJAX responses with transients: `get_transient / set_transient`. For public endpoints, migrate to WP REST API (`register_rest_route`) which benefits from object caching. Profile with Query Monitor plugin.',
    docsUrl:       'https://developer.wordpress.org/plugins/javascript/ajax/',
  },

  {
    id:          'wordpress-plugin-conflict',
    framework:   'wordpress',
    name:        'Plugin JavaScript Conflict',
    description: 'Two plugins register conflicting globals, jQuery versions, or duplicate script handles.',
    issueType:   'js_error',
    severity:    'medium',
    triggerPatterns: [
      'wp-content/plugins.*error',
      'plugin.*conflict',
      'duplicate.*script.*handle',
      'Cannot redefine property.*wp',
      'already been registered',
    ],
    rootCause:     'Two plugins enqueue different jQuery versions, register duplicate script handles, or override each other\'s global variables. WordPress can only enqueue each handle once — the first registration wins.',
    fixSuggestion: 'Deactivate plugins one-by-one to identify the conflict pair. Use browser DevTools Sources tab to trace the conflicting script. If both plugins need jQuery, ensure both use the bundled WP jQuery via the dependency system.',
    docsUrl:       null,
  },

  // ── Django ─────────────────────────────────────────────────────────────────

  {
    id:          'django-csrf-forbidden',
    framework:   'django',
    name:        'CSRF Verification Failed — 403',
    description: 'Django\'s CSRF middleware rejects a POST request with 403 Forbidden.',
    issueType:   'network_failure',
    severity:    'critical',
    triggerPatterns: [
      'CSRF.*verification.*failed',
      '403.*Forbidden.*csrf',
      'csrf_token.*missing',
      'Forbidden.*CSRF',
      'csrf middleware',
    ],
    rootCause:     'The CSRF token was not sent, was expired, or the origin is not in CSRF_TRUSTED_ORIGINS. Common in: AJAX calls missing the X-CSRFToken header, cookie SameSite=Strict blocking cross-origin cookies, or missing @csrf_protect decorator.',
    fixSuggestion: 'For AJAX: include `X-CSRFToken: getCookie("csrftoken")` header. For REST APIs: use SessionAuthentication with `enforce_csrf_checks=True` or switch to token auth. Add domains to `CSRF_TRUSTED_ORIGINS = ["https://app.example.com"]`.',
    docsUrl:       'https://docs.djangoproject.com/en/stable/ref/csrf/',
  },

  {
    id:          'django-disallowed-host',
    framework:   'django',
    name:        'DisallowedHost — ALLOWED_HOSTS Missing',
    description: 'Django rejects the request because the Host header is not in ALLOWED_HOSTS.',
    issueType:   'page_crash',
    severity:    'critical',
    triggerPatterns: [
      'DisallowedHost',
      'ALLOWED_HOSTS',
      'Invalid HTTP_HOST header',
      'DisallowedHost.*not in',
      'Bad Request.*400.*Host',
    ],
    rootCause:     'The production domain or IP is not listed in settings.ALLOWED_HOSTS. Django enforces this to prevent HTTP Host header injection attacks. The setting defaults to an empty list which blocks all requests in production.',
    fixSuggestion: 'Add your domain: `ALLOWED_HOSTS = ["app.example.com", "www.example.com"]`. Use environment variable: `ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")`. Include "." prefix for subdomains: ".example.com".',
    docsUrl:       'https://docs.djangoproject.com/en/stable/ref/settings/#allowed-hosts',
  },

  // ── Ruby on Rails ──────────────────────────────────────────────────────────

  {
    id:          'rails-csrf-422',
    framework:   'rails',
    name:        'CSRF Authenticity Token — 422',
    description: 'Rails rejects a form submission with 422 Unprocessable Entity due to invalid authenticity token.',
    issueType:   'network_failure',
    severity:    'critical',
    triggerPatterns: [
      'ActionController::InvalidAuthenticityToken',
      'authenticity.*token',
      '422.*rails',
      'Can.*verify.*authenticity',
      'CSRF token authenticity',
    ],
    rootCause:     'The Rails authenticity token was not included in the request, or the session expired. Common in cached pages that serve stale CSRF tokens, or in single-page apps that don\'t refresh tokens between navigations.',
    fixSuggestion: 'Ensure `<%= csrf_meta_tags %>` is in application.html.erb. For Turbo/Hotwire: tokens are refreshed automatically. For AJAX: use `$.ajaxSetup({ headers: { "X-CSRF-Token": $("meta[name=csrf-token]").attr("content") } })`. Check `protect_from_forgery with: :exception`.',
    docsUrl:       'https://api.rubyonrails.org/classes/ActionController/RequestForgeryProtection.html',
  },

  {
    id:          'rails-asset-not-precompiled',
    framework:   'rails',
    name:        'Asset Not Precompiled',
    description: 'A CSS or JS asset is referenced in code but was not included in the Sprockets/Webpacker precompile list.',
    issueType:   'network_failure',
    severity:    'medium',
    triggerPatterns: [
      'asset.*not precompiled',
      'Sprockets::Rails::Helper::AssetNotPrecompiled',
      'Webpacker::Manifest::MissingEntryError',
      'asset.*not found.*production',
      'missing.*asset.*sprockets',
    ],
    rootCause:     'The asset is not listed in `config.assets.precompile` or was not included in the Webpack entry points. Sprockets and Webpacker only compile explicitly listed assets in production.',
    fixSuggestion: 'Add to `config/initializers/assets.rb`: `Rails.application.config.assets.precompile += %w[my_file.css my_file.js]`. For Webpacker, add the file as an entry point or import it from an existing entry. Run `bundle exec rails assets:precompile` to verify.',
    docsUrl:       'https://guides.rubyonrails.org/asset_pipeline.html#precompiling-assets',
  },

  // ── Vue / Nuxt ─────────────────────────────────────────────────────────────

  {
    id:          'vue-missing-required-prop',
    framework:   'vue',
    name:        'Missing Required Prop',
    description: 'A Vue component required prop is not passed, causing a prop validation warning.',
    issueType:   'console_warning',
    severity:    'low',
    triggerPatterns: [
      'Missing required prop',
      'prop.*validation failed',
      'Required prop.*missing',
      'Expected.*but got.*undefined',
      '\\[Vue warn\\].*prop',
    ],
    rootCause:     'A required prop defined in the component\'s props option was not passed by the parent. This often indicates a template refactor that forgot to pass a prop, or a conditional rendering path where the component is mounted without full data.',
    fixSuggestion: 'Check every usage of the component in templates and JSX. Add default values for non-critical props: `props: { myProp: { type: String, default: "" } }`. Use TypeScript with `defineProps<{ myProp: string }>()` for compile-time prop safety.',
    docsUrl:       'https://vuejs.org/guide/components/props.html',
  },

  {
    id:          'vue-vuex-mutation-outside-handler',
    framework:   'vue',
    name:        'Vuex State Mutation Outside Handler',
    description: 'Vuex store state is mutated directly rather than through a mutation handler.',
    issueType:   'console_warning',
    severity:    'medium',
    triggerPatterns: [
      'do not mutate vuex store state outside mutation handlers',
      '\\[vuex\\] Do not mutate',
      'vuex.*mutation.*strict',
      'strict mode.*direct mutation',
    ],
    rootCause:     'In strict mode, Vuex throws when state is mutated outside a mutation. Common causes: directly assigning to `this.$store.state.foo`, or mutating a store object reference instead of replacing it.',
    fixSuggestion: 'Use `store.commit("mutationName", payload)` to change state. For complex state trees, use Pinia which has a simpler mutation model. Never directly assign: `this.$store.state.user = newUser` — use a mutation instead.',
    docsUrl:       'https://vuex.vuejs.org/guide/strict.html',
  },

  // ── Angular ────────────────────────────────────────────────────────────────

  {
    id:          'angular-expression-changed-after-check',
    framework:   'angular',
    name:        'ExpressionChangedAfterItHasBeenCheckedError',
    description: 'Angular detects that a binding value changed after change detection already read it.',
    issueType:   'js_error',
    severity:    'medium',
    triggerPatterns: [
      'ExpressionChangedAfterItHasBeenCheckedError',
      'Expression.*changed.*after.*checked',
      'expression.*changed.*detection',
      'NG0100',
    ],
    rootCause:     'A lifecycle hook (ngAfterViewInit, ngAfterContentInit) modifies a property that a parent template binding already read during the same change detection cycle. This is only thrown in development mode.',
    fixSuggestion: 'Wrap the property update in `Promise.resolve().then(() => this.value = newValue)` to defer it to the next tick. Alternatively, use `ChangeDetectorRef.detectChanges()` immediately after mutation. Consider restructuring to avoid mutating parent-bound data in lifecycle hooks.',
    docsUrl:       'https://angular.io/errors/NG0100',
  },

  {
    id:          'angular-zone-runout',
    framework:   'angular',
    name:        'Zone.js Change Detection Blocked',
    description: 'Long-running operations run inside Angular\'s zone, blocking UI updates and degrading performance.',
    issueType:   'slow_load',
    severity:    'medium',
    triggerPatterns: [
      'NgZone.*runOutsideAngular',
      'zone\\.js.*blocking',
      'change detection.*slow',
      'Zone.*timeout.*ms',
      'long task.*zone',
    ],
    rootCause:     'CPU-intensive or I/O operations run inside Angular\'s zone, triggering change detection on every microtask. Common causes: polling intervals, WebSocket event handlers, third-party library callbacks all triggering unnecessary CD cycles.',
    fixSuggestion: 'Move non-UI operations outside Angular\'s zone: `this.ngZone.runOutsideAngular(() => heavyWork())`. Re-enter for UI updates: `this.ngZone.run(() => this.data = result)`. For components with many bindings, use OnPush change detection strategy.',
    docsUrl:       'https://angular.io/api/core/NgZone',
  },
]

// ── DB seed function ──────────────────────────────────────────────────────────

/**
 * Persist all known signatures to the failure_signatures table.
 * Idempotent: existing rows are skipped (ON CONFLICT DO NOTHING).
 * Call once from a cron job or admin endpoint; also generates embeddings
 * for any rows that don't have one yet.
 */
export async function seedKnownSignatures(): Promise<{ inserted: number; skipped: number }> {
  const db = getAdminClient()

  // Check which IDs already exist
  const { data: existing } = await db
    .from('failure_signatures')
    .select('id')

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id))
  const toInsert    = KNOWN_SIGNATURES.filter((s) => !existingIds.has(s.id))

  if (toInsert.length === 0) return { inserted: 0, skipped: KNOWN_SIGNATURES.length }

  // Generate embeddings for new signatures (one batch call)
  const texts = toInsert.map(
    (s) => `${s.framework} ${s.issueType}: ${s.name}. ${s.description} ${s.rootCause}`
  )
  const embeddings = await generateBatchEmbeddings(texts)

  const rows = toInsert.map((s, i) => ({
    id:               s.id,
    framework:        s.framework,
    name:             s.name,
    description:      s.description,
    issue_type:       s.issueType,
    severity:         s.severity,
    trigger_patterns: s.triggerPatterns,
    root_cause:       s.rootCause,
    fix_suggestion:   s.fixSuggestion,
    docs_url:         s.docsUrl ?? null,
    embedding:        embeddings[i] ?? null,
  }))

  const { error } = await db.from('failure_signatures').insert(rows)
  if (error) {
    console.error('[known-signatures] seed failed:', error.message)
    return { inserted: 0, skipped: existingIds.size }
  }

  console.log(`[known-signatures] seeded ${rows.length} signature(s)`)
  return { inserted: rows.length, skipped: existingIds.size }
}
