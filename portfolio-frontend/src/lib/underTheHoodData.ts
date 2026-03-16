/**
 * Under-the-Hood metadata for every feature/section in the portfolio.
 *
 * Each entry describes the end-to-end request path, the AWS/infra resources
 * involved, key source files, Terraform resources, tradeoffs, failure modes,
 * and observability hooks - everything a recruiter or engineer would want to
 * see when evaluating system-thinking ability.
 */

// ─── Types ─────────────────────────────────────────────────────────────
export interface RequestHop {
    label: string;
    detail?: string;
}

export interface KeyFile {
    path: string;       // relative path from repo root
    description: string;
    lines?: string;     // e.g. "L33-L175"
}

export interface TerraformResource {
    resource: string;   // e.g. "aws_cloudfront_distribution.frontend"
    file: string;       // e.g. "cloudfront.tf"
    purpose: string;
}

export interface Tradeoff {
    decision: string;
    why: string;
    alternative: string;
}

export interface FeatureMeta {
    featureId: string;
    title: string;
    subtitle: string;
    whyItExists: string;
    chips: ChipDef[];
    requestPath: RequestHop[];
    keyFiles: KeyFile[];
    terraformResources: TerraformResource[];
    awsServices: string[];
    tradeoffs: Tradeoff[];
    failureModes: string[];
    observability: string[];
}

export interface ChipDef {
    label: string;
    icon: 'cloud' | 'lambda' | 'database' | 'cicd' | 'shield' | 'globe' | 'cpu' | 'key' | 'bot' | 'chart' | 'search' | 'file' | 'cache' | 'terminal';
    color: string;  // tailwind bg-* class suffix color
}

const REPO = 'Siddardha-23/portfolio';
const gh = (path: string, lines?: string) =>
    `https://github.com/${REPO}/blob/main/${path}${lines ? `#${lines}` : ''}`;

// ─── Feature Metadata ──────────────────────────────────────────────────
export const FEATURES: FeatureMeta[] = [
    // ──────────── HERO / LANDING ────────────
    {
        featureId: 'hero',
        title: 'Hero & Recruiter Panel',
        subtitle: 'First impression + live visitor stats',
        whyItExists:
            'The hero section needs to hook recruiters in under 5 seconds. The recruiter panel shows live visitor analytics to demonstrate real engagement - not just a static page.',
        chips: [
            { label: 'CloudFront cache', icon: 'cache', color: 'amber' },
            { label: 'Lambda cold start', icon: 'lambda', color: 'orange' },
            { label: 'Mongo query', icon: 'database', color: 'green' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'React SPA loads from CloudFront edge cache' },
            { label: 'CloudFront', detail: 'Serves index.html + chunks from S3 origin' },
            { label: 'API Gateway', detail: 'GET /api/info/stats → throttled at 50 req/s' },
            { label: 'Lambda', detail: 'Flask handler invoked via Mangum ASGI adapter' },
            { label: 'MongoDB Atlas', detail: 'Aggregation pipeline on visitors collection' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/components/sections/Hero.tsx', description: 'Hero layout + RecruiterPanel with live stats', lines: 'L85-L281' },
            { path: 'portfolio-frontend/src/lib/api.ts', description: 'API service layer - getVisitorStats()', lines: 'L179-L198' },
            { path: 'portfolio-backend/blueprints/info.py', description: 'Visitor stats aggregation endpoint' },
            { path: 'portfolio-backend/services/visitor_service.py', description: 'MongoDB aggregation pipelines for analytics' },
        ],
        terraformResources: [
            { resource: 'aws_cloudfront_distribution.frontend', file: 'cloudfront.tf', purpose: 'CDN for static assets with 31536000s cache TTL' },
            { resource: 'aws_s3_bucket.frontend', file: 's3.tf', purpose: 'Origin bucket for React build artifacts' },
            { resource: 'aws_lambda_function.backend', file: 'lambda.tf', purpose: 'Python 3.12 runtime with Mangum ASGI adapter' },
        ],
        awsServices: ['CloudFront', 'S3', 'API Gateway', 'Lambda', 'Route 53', 'ACM'],
        tradeoffs: [
            {
                decision: 'Serverless Lambda instead of ECS/Fargate',
                why: 'Zero cost at idle, auto-scales to thousands of concurrent requests, no server management. Perfect for a portfolio with bursty traffic patterns.',
                alternative: 'ECS Fargate would eliminate cold starts but costs ~$15-30/month even idle',
            },
            {
                decision: 'CloudFront + S3 over direct S3 hosting',
                why: 'Global edge caching reduces latency to <50ms worldwide, HTTPS enforcement, and cache-control headers for optimal performance.',
                alternative: 'S3 website hosting lacks HTTPS, custom domain support requires more config',
            },
        ],
        failureModes: [
            'Lambda cold start adds ~1-2s on first request after idle (mitigated by lightweight Flask app)',
            'MongoDB Atlas connection timeout - retried with exponential backoff',
            'CloudFront origin failover - returns cached stale content if S3 is unreachable',
        ],
        observability: [
            'CloudWatch Logs: /aws/lambda/portfolio-backend (14-day retention)',
            'API Gateway access logs with request ID, latency, status code',
            'CloudFront standard metrics: cache hit ratio, 4xx/5xx error rate',
        ],
    },

    // ──────────── VISITOR TRACKING ────────────
    {
        featureId: 'visitor-tracking',
        title: 'Visitor Tracking & Analytics',
        subtitle: 'Fingerprint-based deduplication + session management',
        whyItExists:
            'Demonstrates real observability engineering: browser fingerprinting, IP geolocation, session lifecycle management, and organization detection - not just page view counting.',
        chips: [
            { label: 'Fingerprint hash', icon: 'key', color: 'violet' },
            { label: 'IP geolocation', icon: 'globe', color: 'blue' },
            { label: 'Mongo upsert', icon: 'database', color: 'green' },
            { label: 'SSM secrets', icon: 'shield', color: 'red' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'Generates device fingerprint (canvas, WebGL, fonts, timezone)' },
            { label: 'CloudFront', detail: 'Passes X-Forwarded-For to API Gateway' },
            { label: 'API Gateway', detail: 'POST /api/info with fingerprint + metadata' },
            { label: 'Lambda', detail: 'Visitor deduplication logic + IP lookup' },
            { label: 'ipinfo.io', detail: 'External API for city/country/org geolocation' },
            { label: 'MongoDB', detail: 'Upsert visitor doc + update session' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/hooks/useVisitorTracking.ts', description: 'Client-side fingerprint generation + tracking hook' },
            { path: 'portfolio-backend/blueprints/info.py', description: 'Visitor endpoint with rate limiting + input validation' },
            { path: 'portfolio-backend/services/visitor_service.py', description: 'Visitor deduplication + org detection logic' },
            { path: 'portfolio-backend/services/ip_service.py', description: 'IP geolocation with caching to reduce API calls' },
            { path: 'portfolio-backend/services/session_service.py', description: 'Session lifecycle: create, validate, track page views' },
        ],
        terraformResources: [
            { resource: 'aws_ssm_parameter.ipinfo_token', file: 'ssm.tf', purpose: 'Encrypted ipinfo.io API token (SecureString)' },
            { resource: 'aws_ssm_parameter.mongodb_uri', file: 'ssm.tf', purpose: 'Encrypted MongoDB Atlas connection URI' },
            { resource: 'aws_lambda_function.backend', file: 'lambda.tf', purpose: 'Env vars reference SSM paths, fetched at runtime' },
        ],
        awsServices: ['Lambda', 'SSM Parameter Store', 'KMS', 'API Gateway'],
        tradeoffs: [
            {
                decision: 'SSM Parameter Store over Secrets Manager',
                why: 'SSM Standard parameters are free (10K params). Secrets Manager costs $0.40/secret/month + API calls. Portfolio doesn\'t need auto-rotation.',
                alternative: 'AWS Secrets Manager would add auto-rotation but cost ~$3/month for 6 secrets',
            },
            {
                decision: 'IP geolocation caching in MongoDB',
                why: 'ipinfo.io has a 50K/month free tier. Caching IP→location mappings in MongoDB avoids redundant lookups and stays well under limits.',
                alternative: 'MaxMind GeoLite2 local DB would eliminate external calls but adds ~28MB to Lambda package',
            },
        ],
        failureModes: [
            'ipinfo.io rate limit or outage - falls back to cached geolocation data',
            'Fingerprint collision - handled via compound index (fingerprint + IP)',
            'Session TTL expiry - auto-creates new session on next visit',
        ],
        observability: [
            'Visitor count, unique IPs, 24h/7d/30d trends in /api/info/stats',
            'Session tracking: total sessions, active 1h, page views per session',
            'Organization detection from reverse DNS / ipinfo.io org field',
        ],
    },

    // ──────────── CONTACT FORM ────────────
    {
        featureId: 'contact',
        title: 'Contact Form',
        subtitle: 'Validated, rate-limited, XSS-safe messaging',
        whyItExists:
            'A contact form seems simple, but production-grade means: server-side validation, XSS sanitization, rate limiting, and storing in a persistent database - not just mailto: links.',
        chips: [
            { label: 'Input sanitization', icon: 'shield', color: 'red' },
            { label: 'Rate limiting', icon: 'cpu', color: 'orange' },
            { label: 'Mongo write', icon: 'database', color: 'green' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'Client-side form validation (Zod schema)' },
            { label: 'CloudFront', detail: 'HTTPS + security headers (CSP, XSS protection)' },
            { label: 'API Gateway', detail: 'POST /api/contact - throttled at 50 req/s burst' },
            { label: 'Lambda', detail: 'Server-side sanitization + rate limit check' },
            { label: 'MongoDB', detail: 'Insert contact message document' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/components/sections/Contact.tsx', description: 'Form UI with client-side validation + animations', lines: 'L108-L458' },
            { path: 'portfolio-frontend/src/lib/api.ts', description: 'submitContact() API call', lines: 'L350-L355' },
            { path: 'portfolio-backend/blueprints/contact.py', description: 'Contact endpoint with input sanitization' },
        ],
        terraformResources: [
            { resource: 'aws_cloudfront_response_headers_policy.security', file: 'cloudfront.tf', purpose: 'CSP, HSTS, X-Frame-Options, XSS protection headers' },
            { resource: 'aws_apigatewayv2_stage.default', file: 'lambda.tf', purpose: 'Throttling: 50 req/s rate, 100 burst limit' },
        ],
        awsServices: ['API Gateway', 'Lambda', 'CloudFront'],
        tradeoffs: [
            {
                decision: 'Server-side sanitization + client validation',
                why: 'Client validation is for UX (instant feedback). Server validation is for security (never trust the client). Both are required for defense-in-depth.',
                alternative: 'Client-only validation can be bypassed with curl/Postman - instant vulnerability',
            },
            {
                decision: 'MongoDB over email-only delivery',
                why: 'Persistent storage enables analytics, prevents message loss if email delivery fails, and provides audit trail.',
                alternative: 'SES email delivery would be simpler but messages are lost if email bounces',
            },
        ],
        failureModes: [
            'Rate limit exceeded → 429 Too Many Requests with retry-after hint',
            'MongoDB write failure → error response with retry suggestion',
            'XSS attempt → sanitized HTML stripped server-side before storage',
        ],
        observability: [
            'Contact messages stored with timestamp + IP address for abuse tracking',
            'API Gateway access logs capture all contact form submissions',
            'Lambda CloudWatch logs record validation failures',
        ],
    },

    // ──────────── AI CHATBOT ────────────
    {
        featureId: 'chatbot',
        title: 'AI Chatbot (Gemini)',
        subtitle: 'Context-aware portfolio assistant',
        whyItExists:
            'Demonstrates real AI integration: not just calling an API, but crafting a system prompt with full portfolio context, managing conversation history, and streaming responses.',
        chips: [
            { label: 'Gemini API', icon: 'bot', color: 'violet' },
            { label: 'SSM secret', icon: 'shield', color: 'red' },
            { label: 'Context window', icon: 'cpu', color: 'blue' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'Chat UI with conversation history in component state' },
            { label: 'CloudFront', detail: 'HTTPS → API Gateway (cache disabled for POST)' },
            { label: 'API Gateway', detail: 'POST /api/chat with message + history array' },
            { label: 'Lambda', detail: 'Builds system prompt from portfolio constants' },
            { label: 'Gemini API', detail: 'Google Generative AI model generates response' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/components/Chatbot.tsx', description: 'Chat UI with typewriter effect + conversation management', lines: 'L125-L314' },
            { path: 'portfolio-backend/blueprints/chat.py', description: 'Chat endpoint - builds prompt + calls Gemini' },
            { path: 'portfolio-backend/services/chat_service.py', description: 'Gemini integration with portfolio context injection' },
        ],
        terraformResources: [
            { resource: 'aws_ssm_parameter.gemini_api_key', file: 'ssm.tf', purpose: 'Encrypted Gemini API key (SecureString)' },
            { resource: 'aws_iam_role_policy.lambda_custom', file: 'lambda.tf', purpose: 'Lambda permission to read SSM parameters' },
        ],
        awsServices: ['Lambda', 'SSM Parameter Store', 'KMS'],
        tradeoffs: [
            {
                decision: 'Gemini over OpenAI GPT',
                why: 'Generous free tier (15 req/min, 1M tokens/day) makes it viable for a portfolio site with no revenue. GPT-3.5 would cost ~$2/1M tokens.',
                alternative: 'OpenAI GPT-4 would be higher quality but cost $30/1M output tokens',
            },
            {
                decision: 'Stateless conversation (history sent per request)',
                why: 'No server-side session storage needed. Conversation history lives in React state. Simpler, cheaper, no database writes per message.',
                alternative: 'Server-side chat sessions would enable cross-device history but adds DB writes + complexity',
            },
        ],
        failureModes: [
            'Gemini API rate limit → 429 with graceful error message in chat bubble',
            'Gemini API outage → timeout after 15s, user sees "service temporarily unavailable"',
            'Token limit exceeded → conversation history truncated to fit context window',
        ],
        observability: [
            'Chat interactions logged in CloudWatch (prompt length, response time)',
            'Gemini API latency tracked via Lambda duration metric',
            'Error rate monitored via API Gateway 5xx count',
        ],
    },

    // ──────────── VISITOR GLOBE ────────────
    {
        featureId: 'visitor-globe',
        title: 'Interactive Visitor Globe',
        subtitle: 'Real-time world map of portfolio visitors',
        whyItExists:
            'Visual proof that the portfolio attracts real, global traffic. Leaflet map with city-level pins and country aggregation - data-driven, not decorative.',
        chips: [
            { label: 'Leaflet map', icon: 'globe', color: 'blue' },
            { label: 'Geo aggregation', icon: 'chart', color: 'green' },
            { label: 'Lazy loaded (~200KB)', icon: 'cache', color: 'amber' },
        ],
        requestPath: [
            { label: 'User action', detail: 'Click "See visitors" → event dispatched' },
            { label: 'React lazy', detail: 'Leaflet + VisitorGlobe chunk loaded on demand' },
            { label: 'API Gateway', detail: 'GET /api/info/org-stats → returns map_locations[]' },
            { label: 'Lambda', detail: 'Aggregates geolocation data from MongoDB' },
            { label: 'Leaflet', detail: 'Renders OpenStreetMap tiles + visitor markers' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/components/VisitorGlobe.tsx', description: 'Leaflet map modal with city-level pins + country flyTo' },
            { path: 'portfolio-frontend/src/components/VisitorShowcase.tsx', description: 'Stats card triggering the globe modal' },
            { path: 'portfolio-frontend/src/lib/api.ts', description: 'getOrgStats() with map_locations response', lines: 'L224-L246' },
        ],
        terraformResources: [
            { resource: 'aws_lambda_function.backend', file: 'lambda.tf', purpose: 'Aggregation query for visitor geo data' },
        ],
        awsServices: ['Lambda', 'API Gateway'],
        tradeoffs: [
            {
                decision: 'Lazy-loaded Leaflet over always-loaded Three.js globe',
                why: 'Leaflet is ~40KB vs Three.js ~150KB. Most users never open the map, so lazy loading saves bandwidth. Real map tiles provide actual geographic context.',
                alternative: 'react-globe.gl (Three.js) would look flashier but adds 150KB+ to initial bundle',
            },
        ],
        failureModes: [
            'OpenStreetMap tile server slow → map shows gray tiles with loading indicator',
            'No visitor data yet → empty map with "No visitors tracked yet" message',
            'Lazy load chunk fails → error boundary shows fallback',
        ],
        observability: [
            'Chunk load time visible in browser Network tab',
            'API response time in CloudWatch Lambda duration',
        ],
    },

    // ──────────── CI/CD PIPELINE ────────────
    {
        featureId: 'cicd',
        title: 'CI/CD Pipeline',
        subtitle: 'GitHub Actions → S3 + Lambda deploy',
        whyItExists:
            'Production CI/CD with deploy provenance: commit SHA tracking, build artifact hashing, CloudFront invalidation, and a live deploy badge in the footer proving what\'s running.',
        chips: [
            { label: 'GitHub Actions', icon: 'cicd', color: 'violet' },
            { label: 'S3 sync', icon: 'cloud', color: 'amber' },
            { label: 'CF invalidation', icon: 'cache', color: 'blue' },
            { label: 'Lambda deploy', icon: 'lambda', color: 'orange' },
        ],
        requestPath: [
            { label: 'git push main', detail: 'Triggers GitHub Actions workflow' },
            { label: 'Build', detail: 'npm ci → npm run build → SHA-256 hash computed' },
            { label: 'S3 sync', detail: 'dist/ synced with cache-control headers per file type' },
            { label: 'CloudFront', detail: 'Full invalidation (/*) triggered after sync' },
            { label: 'Lambda', detail: 'Backend zip uploaded + function code updated' },
            { label: 'Manifest', detail: 'deploy-manifest.json uploaded to S3 (no-cache)' },
        ],
        keyFiles: [
            { path: '.github/workflows/deploy.yml', description: 'Complete CI/CD workflow: frontend + backend + deploy manifest' },
            { path: 'portfolio-frontend/src/components/DeployBadge.tsx', description: 'Live deploy provenance badge in footer' },
            { path: 'infrastructure/terraform/s3.tf', description: 'S3 bucket with versioning + lifecycle rules' },
            { path: 'infrastructure/terraform/cloudfront.tf', description: 'CloudFront distribution with OAC + security headers' },
        ],
        terraformResources: [
            { resource: 'aws_s3_bucket.frontend', file: 's3.tf', purpose: 'Versioned bucket for frontend assets' },
            { resource: 'aws_cloudfront_distribution.frontend', file: 'cloudfront.tf', purpose: 'CDN with OAC, security headers, SPA routing' },
            { resource: 'aws_lambda_function.backend', file: 'lambda.tf', purpose: 'Backend function updated via CI/CD' },
            { resource: 'aws_cloudfront_origin_access_control.frontend', file: 'cloudfront.tf', purpose: 'OAC prevents direct S3 access' },
        ],
        awsServices: ['S3', 'CloudFront', 'Lambda', 'API Gateway', 'IAM'],
        tradeoffs: [
            {
                decision: 'GitHub Actions over AWS CodePipeline',
                why: 'GitHub Actions is free for public repos, tightly integrated with the repo, and has a massive marketplace. CodePipeline would add $1/month per pipeline + be harder to debug.',
                alternative: 'AWS CodePipeline integrates natively but costs more and has less community tooling',
            },
            {
                decision: 'Full CloudFront invalidation (/*) vs selective paths',
                why: 'Vite content-hashed filenames mean only index.html actually needs invalidation. /* is simpler and the first 1000 invalidations/month are free.',
                alternative: 'Selective invalidation (/index.html, /*.json) would be more precise but adds complexity for no real cost savings',
            },
        ],
        failureModes: [
            'S3 sync failure → deployment stops, previous version stays live',
            'CloudFront invalidation takes up to 10 minutes to propagate globally',
            'Lambda package too large (>50MB) → falls back to S3 upload strategy',
        ],
        observability: [
            'deploy-manifest.json in footer shows SHA, build time, CF status',
            'GitHub Actions run logs with per-step timing',
            'CloudFront invalidation ID tracked in workflow output',
        ],
    },

    // ──────────── RESUME PARSER ────────────
    {
        featureId: 'resume-parser',
        title: 'AI Resume Parser & Tailor',
        subtitle: 'Async job pattern with Gemini AI',
        whyItExists:
            'Demonstrates production-grade async processing: job queue pattern to work around API Gateway 30s timeout, progress polling, and AI-powered document analysis.',
        chips: [
            { label: 'Async job queue', icon: 'cpu', color: 'violet' },
            { label: 'Gemini AI', icon: 'bot', color: 'blue' },
            { label: 'Lambda self-invoke', icon: 'lambda', color: 'orange' },
            { label: 'JWT auth', icon: 'shield', color: 'red' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'Upload resume PDF → submit for analysis' },
            { label: 'API Gateway', detail: 'POST /api/resume/upload → returns job_id immediately' },
            { label: 'Lambda (sync)', detail: 'Creates job in MongoDB, invokes self async' },
            { label: 'Lambda (async)', detail: 'Background: parses PDF → calls Gemini → updates job' },
            { label: 'Browser poll', detail: 'GET /api/resume/job/{id} every 2s until completed' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/pages/ResumeParser.tsx', description: 'Full resume parser UI with progress tracking' },
            { path: 'portfolio-frontend/src/lib/api.ts', description: 'pollJob() async polling utility', lines: 'L568-L597' },
            { path: 'portfolio-backend/blueprints/resume.py', description: 'Resume endpoints with async job pattern' },
            { path: 'portfolio-backend/services/resume_service.py', description: 'PDF parsing + Gemini integration for tailoring' },
            { path: 'portfolio-backend/lambda_handler.py', description: 'Mangum handler with Lambda self-invocation support' },
        ],
        terraformResources: [
            { resource: 'aws_iam_role_policy.lambda_custom', file: 'lambda.tf', purpose: 'lambda:InvokeFunction permission for self-invocation' },
            { resource: 'aws_ssm_parameter.gemini_api_key', file: 'ssm.tf', purpose: 'Gemini API key for AI analysis' },
            { resource: 'aws_ssm_parameter.job_search_password_hash', file: 'ssm.tf', purpose: 'Bcrypt hash for dashboard access control' },
        ],
        awsServices: ['Lambda', 'API Gateway', 'SSM Parameter Store', 'KMS'],
        tradeoffs: [
            {
                decision: 'Lambda self-invocation over SQS/Step Functions',
                why: 'Self-invocation is simpler: no extra infrastructure. The Lambda invokes itself asynchronously with InvocationType=Event, bypassing the 30s API Gateway timeout.',
                alternative: 'SQS + Lambda trigger would be more robust but adds queue management, DLQ config, and Terraform resources',
            },
            {
                decision: 'Client-side polling over WebSockets',
                why: 'Polling every 2s is simple, stateless, and works through CloudFront. WebSockets would need API Gateway WebSocket API - much more complex for a 30-90s job.',
                alternative: 'API Gateway WebSocket API would give real-time updates but adds significant infrastructure complexity',
            },
        ],
        failureModes: [
            'Gemini API timeout → job marked as "failed" with retry option',
            'PDF parsing failure → error returned with supported format guidance',
            'Poll timeout (90s) → client shows timeout message with retry button',
            'Lambda cold start + Gemini call may exceed 29s API GW timeout → hence async pattern',
        ],
        observability: [
            'Job status tracked in MongoDB: pending → processing → completed/failed',
            'Lambda invocation duration logged in CloudWatch',
            'Async invocation errors logged separately from sync handler',
        ],
    },

    // ──────────── WELCOME TERMINAL ────────────
    {
        featureId: 'welcome-terminal',
        title: 'Interactive Terminal',
        subtitle: 'CLI-style portfolio gateway',
        whyItExists:
            'First interaction a visitor has. Simulates a real Linux terminal with tab completion, command history, and file browsing - proving real CLI/systems experience, not just a UI trick.',
        chips: [
            { label: 'Static render', icon: 'cache', color: 'amber' },
            { label: 'No API calls', icon: 'cloud', color: 'green' },
            { label: 'Tab completion', icon: 'terminal', color: 'violet' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'CloudFront serves pre-built SPA' },
            { label: 'React', detail: 'Welcome.tsx renders terminal UI - all client-side' },
            { label: 'No backend', detail: 'Commands like ls, cat, whoami run entirely in browser' },
        ],
        keyFiles: [
            { path: 'portfolio-frontend/src/pages/Welcome.tsx', description: 'Full terminal emulator: commands, tab completion, history' },
            { path: 'portfolio-frontend/src/components/WelcomeForm.tsx', description: 'Visitor role selection form (optional)' },
            { path: 'portfolio-frontend/src/lib/constants.ts', description: 'Portfolio data used by terminal "cat" command' },
        ],
        terraformResources: [
            { resource: 'aws_cloudfront_distribution.frontend', file: 'cloudfront.tf', purpose: 'Serves SPA from edge - no backend needed for this page' },
        ],
        awsServices: ['CloudFront', 'S3'],
        tradeoffs: [
            {
                decision: 'Client-side terminal over real SSH/backend',
                why: 'Security: never expose a real terminal to the internet. Performance: instant response with no latency. All portfolio data is public anyway.',
                alternative: 'Containerized terminal (xterm.js + backend shell) would be "real" but is a massive security risk',
            },
        ],
        failureModes: [
            'SPA fails to load → CloudFront custom error page (index.html with 200)',
            'JavaScript disabled → blank page (acceptable for developer portfolio audience)',
        ],
        observability: [
            'CloudFront cache hit ratio for static assets',
            'Core Web Vitals via Lighthouse (LCP, FID, CLS)',
        ],
    },

    // ──────────── INFRASTRUCTURE AS CODE ────────────
    {
        featureId: 'request-tracer',
        title: 'Distributed Request Tracing',
        subtitle: 'Live waterfall visualization of request lifecycle',
        whyItExists:
            'Most portfolios just show static pages. This feature lets recruiters fire a real HTTP request and watch it traverse CloudFront → API Gateway → Lambda → MongoDB in real time - proving production-grade observability skills.',
        chips: [
            { label: 'X-Ray', icon: 'chart', color: 'amber' },
            { label: 'Resource Timing API', icon: 'globe', color: 'blue' },
            { label: 'MongoDB Atlas', icon: 'database', color: 'green' },
        ],
        requestPath: [
            { label: 'Browser', detail: 'Clears Resource Timing buffer, fires fetch with cache: no-store' },
            { label: 'CloudFront', detail: 'Edge routing to API Gateway origin' },
            { label: 'API Gateway', detail: 'HTTP API v2.0 proxy to Lambda' },
            { label: 'Lambda', detail: 'Flask routing + cold start detection + metadata injection' },
            { label: 'MongoDB Atlas', detail: 'Infra mode: db.command("ping") | Data mode: 5 real aggregation pipelines' },
            { label: 'Response', detail: 'Server timing merged with client Resource Timing API data' },
        ],
        keyFiles: [
            { path: 'portfolio-backend/blueprints/trace.py', description: 'Trace endpoints (/trace and /trace/deep)' },
            { path: 'portfolio-frontend/src/components/RequestTracer.tsx', description: 'Waterfall chart modal with dual-mode tracing' },
            { path: 'portfolio-frontend/src/lib/api.ts', description: 'traceRequest() + traceDeepRequest() with Resource Timing API', lines: 'L679-L780' },
            { path: 'portfolio-backend/lambda_handler.py', description: 'Cold start detection + metadata injection into builtins' },
        ],
        terraformResources: [
            { resource: 'aws_lambda_function.backend', file: 'lambda.tf', purpose: 'Lambda with X-Ray tracing enabled' },
            { resource: 'aws_iam_role_policy.xray_write', file: 'lambda.tf', purpose: 'IAM policy allowing X-Ray PutTraceSegments' },
        ],
        awsServices: ['X-Ray', 'Lambda', 'API Gateway', 'CloudFront', 'CloudWatch'],
        tradeoffs: [
            {
                decision: 'Two trace modes (Infra + Data Query)',
                why: 'Infra trace shows network/infra latency with a simple ping. Data Query trace runs real aggregation pipelines that power the portfolio sections - showing realistic DB latency.',
                alternative: 'Single trace mode would be simpler but wouldn\'t demonstrate real data layer performance',
            },
            {
                decision: 'Browser Resource Timing API over server-only timing',
                why: 'Server can\'t measure DNS, TCP/TLS, or TTFB. Combining both gives a true end-to-end picture.',
                alternative: 'Server-only timing misses network layer; Navigation Timing only works for page loads, not XHR',
            },
        ],
        failureModes: [
            'Cross-origin Resource Timing zeroed out - Timing-Allow-Origin header needed on CloudFront',
            'Lambda cold start inflates first trace - clearly labeled with red badge',
            'X-Ray trace ID unavailable locally - gracefully hidden when not on Lambda',
        ],
        observability: [
            'X-Ray trace ID deep-linked to AWS console in modal',
            'Every span individually timed with performance.now() (client) and time.perf_counter() (server)',
            'Cold start flag + init_duration_ms injected via lambda_handler.py',
        ],
    },
    {
        featureId: 'infrastructure',
        title: 'Infrastructure as Code',
        subtitle: 'Terraform-managed AWS resources',
        whyItExists:
            'Every resource in this portfolio is code-defined and reproducible. No ClickOps. This section proves IaC fluency - the actual Terraform modules powering the site.',
        chips: [
            { label: 'Terraform', icon: 'terminal', color: 'violet' },
            { label: '9 AWS services', icon: 'cloud', color: 'amber' },
            { label: 'SSM secrets', icon: 'shield', color: 'red' },
        ],
        requestPath: [
            { label: 'terraform plan', detail: 'Diff against current state' },
            { label: 'terraform apply', detail: 'Create/update AWS resources' },
            { label: 'State stored', detail: 'terraform.tfstate tracks resource IDs' },
        ],
        keyFiles: [
            { path: 'infrastructure/terraform/main.tf', description: 'Provider config + data sources' },
            { path: 'infrastructure/terraform/cloudfront.tf', description: 'CDN distribution + DNS + security headers' },
            { path: 'infrastructure/terraform/lambda.tf', description: 'Lambda + API Gateway + IAM roles' },
            { path: 'infrastructure/terraform/s3.tf', description: 'Frontend bucket + OAC policy + lifecycle rules' },
            { path: 'infrastructure/terraform/ssm.tf', description: '6 encrypted parameters in SSM Parameter Store' },
            { path: 'infrastructure/terraform/variables.tf', description: 'Parameterized config for multi-env support' },
        ],
        terraformResources: [
            { resource: 'aws_cloudfront_distribution.frontend', file: 'cloudfront.tf', purpose: 'Main CDN distribution with 2 origins (S3 + API Gateway)' },
            { resource: 'aws_lambda_function.backend', file: 'lambda.tf', purpose: 'Python 3.12 Lambda with SSM env vars' },
            { resource: 'aws_apigatewayv2_api.backend', file: 'lambda.tf', purpose: 'HTTP API with CORS + throttling' },
            { resource: 'aws_s3_bucket.frontend', file: 's3.tf', purpose: 'Versioned, encrypted, OAC-protected bucket' },
            { resource: 'aws_acm_certificate', file: 'acm.tf', purpose: 'DNS-validated SSL/TLS certificate' },
            { resource: 'aws_route53_record.root', file: 'cloudfront.tf', purpose: 'A + AAAA records pointing to CloudFront' },
        ],
        awsServices: ['CloudFront', 'S3', 'Lambda', 'API Gateway', 'Route 53', 'ACM', 'SSM', 'KMS', 'IAM', 'CloudWatch'],
        tradeoffs: [
            {
                decision: 'Terraform over CloudFormation',
                why: 'Terraform is cloud-agnostic, has HCL syntax (more readable than JSON/YAML), better state management, and a massive provider ecosystem.',
                alternative: 'CloudFormation is AWS-native (no state file management) but JSON/YAML is verbose and error-prone',
            },
            {
                decision: 'SSM Parameter Store over Secrets Manager',
                why: 'SSM Standard parameters are free. 6 secrets × $0.40/month = $2.40/month saved with SSM. Portfolio doesn\'t need auto-rotation.',
                alternative: 'Secrets Manager adds auto-rotation + cross-account sharing but at $0.40/secret/month',
            },
        ],
        failureModes: [
            'Terraform state drift - detected by plan, fixed by targeted apply or import',
            'ACM certificate validation timeout - DNS propagation can take up to 72 hours',
            'Lambda deployment package exceeds 250MB unzipped limit - solved by stripping bloat in CI',
        ],
        observability: [
            'terraform plan output shows exact resource changes before apply',
            'AWS CloudTrail logs all API calls made by Terraform',
            'terraform.tfstate tracks every resource ID + attribute',
        ],
    },
];

// ─── Lookup helper ─────────────────────────────────────────────────────
export function getFeature(id: string): FeatureMeta | undefined {
    return FEATURES.find((f) => f.featureId === id);
}

/** Map sectionId → featureIds to show chips on each section */
export const SECTION_CHIPS: Record<string, string[]> = {
    hero: ['hero'],
    about: ['welcome-terminal', 'infrastructure', 'request-tracer'],
    skills: ['infrastructure'],
    education: [],
    experience: [],
    projects: ['cicd', 'infrastructure'],
    contact: ['contact'],
};

export { gh };
