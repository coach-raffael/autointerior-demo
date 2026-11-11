# Statischer Build hinter static-web-server (Rust, Image ohne Betriebssystem-Pakete → kaum Angriffsfläche
# und ein sauberer Image-Scan). BASE_PATH kommt vom Showcase-Hub (build-showcase), z. B. /car-interior –
# die Dateien liegen genau unter diesem Pfad, weil Traefik den Präfix nicht abschneidet.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
RUN npm run build

FROM joseluisq/static-web-server:2
ARG BASE_PATH=""
COPY --from=build /app/dist /public${BASE_PATH}
# Port 8080, kein Root; /car-interior wird auf /car-interior/ umgeleitet (Standard), Kompression an
ENV SERVER_PORT=8080 \
    SERVER_ROOT=/public \
    SERVER_REDIRECT_TRAILING_SLASH=true \
    SERVER_COMPRESSION=true \
    SERVER_CACHE_CONTROL_HEADERS=true \
    SERVER_DIRECTORY_LISTING=false
USER 65534:65534
EXPOSE 8080
