FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node worker.mjs ./worker.mjs
USER node
CMD ["node", "worker.mjs"]
