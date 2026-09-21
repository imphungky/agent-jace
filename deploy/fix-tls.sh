#!/usr/bin/env bash
# fix-tls.sh — repair the Let's Encrypt renewal chain on the droplet and issue a
# fresh certificate. Run as root on the droplet:
#
#   bash deploy/fix-tls.sh
#
# WHY THIS EXISTS
# The first cert was issued with `--standalone` (the chicken-and-egg bootstrap in
# deploy/README.md step 1), but step 3 -- switching the saved renewal method to
# `webroot` -- was never applied. Standalone renewal binds port 80 itself, which
# the nginx container already holds, so every renewal attempt failed with
# "Could not bind TCP port 80". Certificate Transparency logs confirm no renewal
# ever succeeded: one cert, issued 2026-06-21, expired 2026-09-19.
#
# WHAT IT CHANGES (and nothing else)
#   1. rewrites /etc/letsencrypt/renewal/<domain>.conf to authenticator = webroot
#   2. installs a deploy hook that reloads the nginx CONTAINER after each renewal
#   3. issues a replacement certificate via the HTTP-01 webroot challenge
#   4. enables certbot's systemd timer so renewals actually run
#   5. reloads nginx so it stops serving the expired cert
#
# It verifies before it acts and stops at the first failure. Re-running it is
# safe: every step is idempotent.

set -uo pipefail

DOMAIN="${DOMAIN:-jacemtg.xyz}"
WEBROOT="/var/www/certbot"

ok()   { printf '  \033[32mOK\033[0m    %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; }
info() { printf '        %s\n' "$*"; }
hdr()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()  { bad "$*"; printf '\nAborted. Nothing further was changed.\n'; exit 1; }

printf '\033[1mTLS repair — %s\033[0m\n' "$DOMAIN"

# --- 1. Preflight ------------------------------------------------------------
# Every assumption this script relies on is checked here, BEFORE anything is
# modified, so a wrong guess fails loudly instead of half-applying.
hdr "1. Preflight"

[[ $EUID -eq 0 ]] || die "must run as root (certbot writes to /etc/letsencrypt)"
command -v certbot >/dev/null 2>&1 || die "certbot is not installed"
ok "running as root, certbot present: $(certbot --version 2>&1 | head -1)"

# Find the nginx container by name rather than assuming a compose-generated
# suffix. This deployment's containers are `mtgagent-nginx` / `mtgagent-app`,
# NOT the `-1`-suffixed names the runbook example used -- hardcoding the wrong
# name is exactly how a deploy hook silently no-ops.
NGINX_CONTAINER="${NGINX_CONTAINER:-$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i nginx | head -1)}"
[[ -n "$NGINX_CONTAINER" ]] || die "no running container with 'nginx' in its name (is the stack up? try: docker compose up -d)"
ok "nginx container: ${NGINX_CONTAINER}"

# Prove we can actually drive that container. `nginx -t` only validates config,
# so this is a safe liveness check for the name we just resolved.
docker exec "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1 \
  || die "'docker exec ${NGINX_CONTAINER} nginx -t' failed -- the deploy hook would not work"
ok "container responds to docker exec (nginx -t passes)"

# The webroot must exist on the HOST: certbot writes the challenge file here and
# nginx reads it through the read-only bind mount declared in compose.yaml.
mkdir -p "$WEBROOT"
ok "webroot present: ${WEBROOT}"

hdr "2. Current state"
if [[ -r "/etc/letsencrypt/renewal/${DOMAIN}.conf" ]]; then
  cur_auth="$(sed -n 's/^[[:space:]]*authenticator[[:space:]]*=[[:space:]]*//p' \
              "/etc/letsencrypt/renewal/${DOMAIN}.conf" | tail -1)"
  info "authenticator = ${cur_auth:-<unset>}  (this is what we are replacing)"
else
  info "no renewal config yet -- one will be created"
fi
if [[ -r "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  info "cert expires: $(openssl x509 -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" -noout -enddate | cut -d= -f2)"
fi

# --- 3. Confirm --------------------------------------------------------------
hdr "3. Confirm"
info "About to request a new certificate for ${DOMAIN} from Let's Encrypt and"
info "rewrite its renewal config to use webroot + a container reload hook."
printf '\n  Proceed? [y/N] '
read -r reply
[[ "$reply" =~ ^[Yy]$ ]] || { printf '\nCancelled. Nothing was changed.\n'; exit 0; }

# --- 4. Reissue + reconfigure in one shot ------------------------------------
# `certonly --webroot` with --deploy-hook rewrites the saved renewal config AND
# obtains a certificate in a single operation, so the config on disk can never
# drift from the method that was just proven to work.
#
# --force-renewal: the existing cert is already expired, and forcing makes the
# run deterministic rather than depending on certbot's renewal-window prompt.
# Rate limits are not a concern -- only one cert has ever been issued.
hdr "4. Requesting certificate via webroot"
certbot certonly --webroot -w "$WEBROOT" \
  -d "$DOMAIN" \
  --cert-name "$DOMAIN" \
  --deploy-hook "docker exec ${NGINX_CONTAINER} nginx -s reload" \
  --non-interactive --agree-tos --force-renewal \
  || die "certbot failed -- see /var/log/letsencrypt/letsencrypt.log"
ok "certificate issued"

# --- 5. Make sure something actually runs renewals ---------------------------
# A correct renewal config renews nothing if no timer invokes it. Debian's
# certbot package ships certbot.timer; the snap ships snap.certbot.renew.timer.
hdr "5. Renewal timer"
for unit in certbot.timer snap.certbot.renew.timer; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^${unit}"; then
    systemctl enable --now "$unit" >/dev/null 2>&1 \
      && ok "${unit} enabled + started" \
      || bad "could not enable ${unit} (check: systemctl status ${unit})"
  fi
done
systemctl list-timers --all 2>/dev/null | grep -qi certbot \
  || bad "still no certbot timer -- renewals will not run automatically"

# --- 6. Reload nginx ---------------------------------------------------------
# The deploy hook fires on renewal, but reload explicitly here too: on a forced
# reissue we want the new cert live immediately, not at the next renewal.
hdr "6. Reloading nginx"
docker exec "$NGINX_CONTAINER" nginx -s reload \
  && ok "nginx reloaded" \
  || bad "reload failed -- try: docker restart ${NGINX_CONTAINER}"

# --- 7. Verify on the wire ---------------------------------------------------
# Reading the cert off port 443 is the only check that proves the fix reached
# the thing browsers actually talk to.
hdr "7. Verification"
sleep 2
served="$(echo | timeout 10 openssl s_client -servername "$DOMAIN" \
            -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null)"
if [[ -n "$served" ]]; then
  ok "served by nginx: ${served#notAfter=}"
else
  bad "could not read the served certificate -- check: docker logs ${NGINX_CONTAINER}"
fi

hdr "Done"
info "Confirm the automation works end to end with:"
info "  certbot renew --dry-run"
printf '\n'
