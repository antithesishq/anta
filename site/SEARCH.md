# Search answers

Full-text search runs in the browser. When it finishes with zero matches, the
dialog shows the empty-results message and bold **Get answer from AI** text in a
selected result row. Clicking anywhere in that row or pressing Enter in the
input sends the query to `/api/search-answer/`
and keeps the dialog open. The endpoint calls
`anta-search-01`'s `chatCompletions()` method with one user message and returns one
streamed answer. Cloudflare uses the indexed documentation as context for the chat.
Changing the query or closing the dialog cancels the browser request. The last
successful answer stays in the island's memory so reopening it does not repeat
the request. Typing, empty results, and index failures do not trigger AI requests.

Full-text search waits until typing pauses for 250 ms, using `es-toolkit`'s
`debounce`. Its loader replaces the search icon inside the input; previous
matches stay visible until the next search finishes. Clearing the query or
closing the dialog cancels pending searches.

The selected AI result row is replaced by a loader until
the first answer text arrives. Markdown then appears progressively under **AI
answer**. The title and close
button are hidden; the dialog keeps its accessible name and closes with Escape
or a backdrop click. The input and results content are centered and capped at
960px. The input occupies the header, and the Dialog body scrolls the output
using the available width. The dialog uses `--bg-2`.

## Answer prompt and rendering

`SYSTEM_PROMPT` in `lib/search/chat-worker.ts` controls the answer for this site.
It asks for Anta documentation links, up to one documented example in Markdown,
and a concise answer of 150–200 words or fewer, excluding code. Props must come
from documentation for the specific component. Missing setup instructions must
be acknowledged instead of inferred.
It overrides the instance's generation prompt for this request; editing it does
not change the Cloudflare dashboard.
The generation model uses the instance setting. The request leaves query
rewriting, reranking, and the retrieval threshold unset. It explicitly limits
retrieval to four chunks: live binding requests returned more than four when
only the dashboard limit was set. It passes
`chat_template_kwargs: { enable_thinking: false }` for Qwen's non-thinking mode.
Recheck this model-specific option if the generation model changes.
The Worker enables AI Search's similarity cache with the
**Exact** threshold (`super_strict_match`), which accepts near-identical queries.
Cache duration uses the instance setting. Cloudflare invalidates cached answers
when their source chunks change. This cache is separate from browser HTTP
caching, so the streamed endpoint keeps `Cache-Control: no-store, no-transform`.
Use AI Search's similarity cache rather than enabling general AI Gateway caching
on the gateway that also handles embedding calls.
When Cloudflare returns no public documentation sources, the endpoint replaces
the generated answer with a message that no relevant documentation was found.

The browser loads Marked and DOMPurify after selecting **Get answer from AI**. Answers
support headings, paragraphs, lists, tables, links, inline code, and fenced code
blocks. Raw HTML and images are removed, and links are checked before rendering.
Expressive Code renders every code block with the same shared configuration,
syntax themes, and copy button as authored documentation. AI output never runs as MDX or
an interactive example. Source links come from Cloudflare's retrieved chunks,
deduplicated by documentation URL; chunk text and metadata stay on the server.

`lib/search/chat-stream.ts` converts Cloudflare SSE into `sources`, `delta`,
`done`, and `error` events. The Worker verifies sources before forwarding model
text, limits answer length, and cancels the upstream reader on disconnect or a
60-second timeout. An interrupted answer stays visible with a retry button; only
a completed answer is cached in the browser. Markdown is sanitized on each update.

## Cloudflare Pages

Keep the AI Search instance's public endpoints disabled. The `anta-search-chat`
Worker accesses the instance through its `AI_SEARCH` binding. Pages forwards the
request through the `SEARCH_CHAT` service binding; no API token is sent to the
browser.

The site build writes `dist/_worker.js`. `public/_routes.json` limits worker
invocations to `/api/search-answer/` and its slashless alias, so documentation and
assets keep using Pages' static serving. This works whether the Pages build root
is the repository or `site/`.

Deploy the chat Worker first:

```sh
pnpm --filter anta-site exec wrangler deploy --config wrangler.chat.jsonc
```

For a PR preview, deploy the separate preview Worker:

```sh
pnpm --filter anta-site exec wrangler deploy --config wrangler.chat.jsonc --env preview
```

The preview service is `anta-search-chat-preview`. It shares the
`anta-search-01` index with local development and the production configuration.
Both Workers accept requests through service bindings and have no public
`workers.dev` endpoint or Worker version preview URL.

`site/wrangler.jsonc` configures Pages' `SEARCH_CHAT` service binding to
`anta-search-chat`. If the existing Git deployment builds from the repository
root and uses dashboard configuration, add that service binding to each Pages
environment that should support answers, then redeploy Pages.
Use `anta-search-chat-preview` for the Pages **Preview** environment and
`anta-search-chat` for **Production**. In the dashboard, these references are
under **Workers & Pages → anta → Settings → Bindings**. The target Worker's
**Settings → Bindings** lists `AI_SEARCH`, which references `anta-search-01`.

Set a Cloudflare rate-limiting rule for POST requests to `/api/search-answer/`
according to the site's traffic budget. The endpoint checks request origin,
content type, body size, and query length; these checks do not replace rate
limiting for a public API.

Pages does not accept `ai_search` in its Wrangler configuration. The separate
Worker uses the current [chat binding](https://developers.cloudflare.com/ai-search/api/search/workers-binding/)
with `stream: true`. The instance's configured generation model supplies the answer.

## Local development

Authenticate Wrangler once, then run the site from the repository root:

```sh
pnpm --filter anta-site exec wrangler login
pnpm run dev
```

The root dev command starts the site, package watcher, and chat Worker together.
Astro proxies `/api/search-answer/` to port 8788; `pnpm run dev -new` uses 8789.
The Worker uses the real Cloudflare instance during local development and
rebuilds when its source changes. Full-text search works without a Cloudflare
login; chat requires a valid login. `pnpm run stop` stops the whole dev process tree.

Run `pnpm --filter anta-site run typecheck:worker` to generate Cloudflare types
and check the endpoint. `pnpm test` includes the fallback and endpoint regression
tests with simulated AI responses.
