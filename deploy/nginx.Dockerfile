# Custom Nginx image: bakes in our config AND the built React app, so the
# container is self-contained (no host bind mounts needed at runtime).
#
# IMPORTANT: build with the repo root as the context so both COPYs resolve, e.g.
#   docker build -f deploy/nginx.Dockerfile -t jace-nginx .
# (compose.yaml sets `context: .` for this reason.)
#
# Build the frontend first — this image copies frontend/dist, it does not build
# it:  cd frontend && npm run build
FROM nginx:1.31.2

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/dist     /usr/share/nginx/html