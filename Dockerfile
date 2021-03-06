FROM node:alpine AS base
RUN ["apk", "add", "tzdata"]
WORKDIR /home/node/app
COPY package.json yarn.lock ./
RUN ["yarn", "install", "--pure-lockfile", "--production"]

FROM base AS builder
RUN ["yarn", "install", "--pure-lockfile"]
COPY . .
RUN ["yarn", "build"]

FROM base
ENV NODE_ENV=production
COPY --from=builder /home/node/app/dist ./dist
VOLUME /home/node/app/dist/config
CMD ["yarn", "start"]
