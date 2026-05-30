<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated - the docs are the source of truth.

# Package manager rule

You may run non-mutating `pnpm` verification commands in this project, such as `pnpm lint` and `pnpm build`.

Do not run dependency-mutating `pnpm` commands such as `pnpm install`, `pnpm add`, `pnpm remove`, `pnpm update`, or `pnpm up`. For those, always give the exact `pnpm` command to the user to run instead.

<!-- END:nextjs-agent-rules -->
