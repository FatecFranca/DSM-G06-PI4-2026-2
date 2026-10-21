FROM node:20-alpine AS build
WORKDIR /app
COPY app/web/package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY app/web .
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80