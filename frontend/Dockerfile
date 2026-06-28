# Dev image: runs the vite dev server with HMR. (Production builds the static
# site via deploy/nginx.Dockerfile instead — this is for `compose.dev.yaml`.)
FROM node:26-alpine3.23

WORKDIR /app

# Install deps first so this layer caches unless the manifests change.
COPY package.json package-lock.json ./
RUN npm ci

# Source is bind-mounted in compose for live reload, so we don't COPY it here.
EXPOSE 5173

# --host 0.0.0.0 makes the dev server reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
