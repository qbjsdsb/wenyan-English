FROM node:20 AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable \
  && corepack prepare yarn@1.22.22 --activate \
  && yarn config set registry https://registry.npmmirror.com \
  && yarn install --frozen-lockfile

COPY . .
RUN yarn build

FROM nginx:alpine
COPY ./public/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /app
