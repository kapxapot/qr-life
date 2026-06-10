<!-- BEGIN:nextjs-agent-rules -->

# Agent rules

## Next.js: read docs before coding

Before any MAJOR Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated - the docs are the source of truth.

Don't read the docs on every small change.

## Package manager rule

You may run non-mutating `pnpm` verification commands in this project, such as `pnpm lint` and `pnpm build`.

Do not run dependency-mutating `pnpm` commands such as `pnpm install`, `pnpm add`, `pnpm remove`, `pnpm update`, or `pnpm up`. For those, always give the exact `pnpm` command to the user to run instead.

## Dependency versus custom implementation rule

Before installing a new package or writing a large custom implementation for something an existing library might already handle, stop and ask the user which route they want.

Do not silently choose between adding a dependency and building a substantial in-repo replacement.

## Revert safety rules

Before any revert, restore, or reset, inspect which files are staged and exclude them by default.

Do not use broad or repo-wide restore/reset/revert commands.

Before running any revert or restore command, list the exact target files first and keep the operation limited to that list.

## JSX conditional rendering rule

For boolean JSX conditions, prefer `condition && <Component />` over `condition ? <Component /> : null`.

## Component file rule

ALWAYS PUT COMPONENTS IN THEIR OWN FILES.

Do not define React components inside another component's file unless the user explicitly asks for an exception.

<!-- END:nextjs-agent-rules -->
