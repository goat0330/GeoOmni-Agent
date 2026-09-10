FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node . .

# Apply the idempotent hardening patch inside the image, leaving the host copy untouched
# when the image is built from a clean checkout.
RUN node tools/apply-enterprise-hardening.mjs --no-backup --no-local-fallback \
    && node --check serve.mjs \
    && node scripts/static-audit.mjs

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

USER node
EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/healthcheck.mjs || exit 1

CMD ["node", "serve.mjs"]
