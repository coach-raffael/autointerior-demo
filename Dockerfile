# Statischer Build hinter nginx (unprivilegiert, Port 8080).
# BASE_PATH kommt vom Showcase-Hub (build-showcase), z. B. /car-interior – die Dateien liegen dann genau
# unter diesem Pfad, weil Traefik den Präfix nicht abschneidet.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
ARG BASE_PATH=""
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html${BASE_PATH}
EXPOSE 8080
