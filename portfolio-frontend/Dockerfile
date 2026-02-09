# Stage 1: Build React app
FROM node:22 AS builder

WORKDIR /app
COPY . .
RUN npm install && npm run build

# Stage 2: Serve with nginx:alpine
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx/default.conf /etc/nginx/conf.d/

# Copy React build output to nginx html folder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
