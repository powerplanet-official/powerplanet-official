<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Code readability

- Write readable, multiline JSX and CSS with two-space indentation.
- Use descriptive names for state, form values, and event handlers.
- Add useful comments for component responsibilities, major UI sections, and
  non-obvious behavior. Explain why a rule exists rather than narrating every line.
- Run `npm run format` after editing UI files and `npm run format:check` before finishing.
