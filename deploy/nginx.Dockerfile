# Custom Nginx image: builds the React app AND bakes in our config, so the
# container is self-contained (no host bind mounts, no Node on the host).
#
# IMPORTANT: build with the repo root as the context so the COPYs resolve, e.g.
#   docker build -f deploy/nginx.Dockerfile -t jace-nginx .
# (compose.yaml sets `context: .` for this reason.)

# --- Stage 1: build the React app --------------------------------------------
# Done inside the image so the VPS only needs Docker — no host Node toolchain,
# and the build is reproducible. frontend/dist is gitignored, so it is built
# here rather than copied from the (cloned) working tree.
FROM node:20 AS build
WORKDIR /app/frontend
# Copy manifests first so `npm ci` is cached unless deps actually change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # tsc -b && vite build -> /app/frontend/dist

# --- Stage 2: nginx serving the build ----------------------------------------
FROM nginx:1.31.2
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
