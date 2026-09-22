# Build and run the adhesion-api image.
#
# The DX release workflow (`release-azure-containerapp-v1.yaml`) builds this
# image with the repository root as context and does not run Nx beforehand, so
# the whole workspace build happens inside the image, in two stages:
#
#   1. `builder` installs the workspace and runs the Nx `prune` target, which
#      produces the standalone bundle (main.js, pruned package.json and
#      lockfile, workspace_modules) under apps/adhesion-api/dist.
#   2. `runtime` ships only that bundle and the production dependencies.
#
# For a local build use `nx docker:build adhesion-api`; run it with
# `nx docker:run adhesion-api -p 3000:3000`.

FROM public.ecr.aws/docker/library/node:24-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# The build runs through Nx: keep it non-interactive and without a daemon.
ENV CI=true
ENV NX_DAEMON=false

# Pin the pnpm version to the repository one instead of letting Corepack pick
# the latest major, whose supply-chain defaults reject the freshly generated
# pruned lockfile.
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

WORKDIR /workspace

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# `prune` runs the production build, rewrites the workspace dependencies to
# local `file:` references and writes the standalone bundle under
# apps/adhesion-api/dist. The workspace code is bundled into main.js, so the
# copied `workspace_modules` are only needed to resolve the file: dependencies.
RUN pnpm exec nx run adhesion-api:prune

# Install the production dependencies into the bundle so the runtime image needs
# neither pnpm nor the workspace.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    cd apps/adhesion-api/dist && pnpm install --prod --frozen-lockfile

FROM public.ecr.aws/docker/library/node:24-alpine AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY --from=builder /workspace/apps/adhesion-api/dist .

USER node

CMD [ "node", "main.js" ]
