FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/api --include-workspace-root=false
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN npx prisma generate && npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
