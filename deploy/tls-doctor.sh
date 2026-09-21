#!/usr/bin/env bash
# tls-doctor.sh — diagnose why the Let's Encrypt cert for this deployment is not
# renewing. READ-ONLY: it inspects state and prints findings, it never changes
# anything. Run it on the droplet as root:
#
#   cd ~/mtgagent && git pull && bash deploy/tls-doctor.sh
#
# Background: certs are issued and renewed by the HOST's certbot into
# /etc/letsencrypt; the nginx container only reads them (see compose.yaml).
# That splits the renewal chain into four links, each of which can break
# independently, and each of which this script checks in order:
#
#   1. certbot has a renewal config, and it says `webroot` (not `standalone`)
#   2. a systemd timer actually fires `certbot renew` on a schedule
#   3. the ACME HTTP-01 challenge reaches nginx over port 80
#   4. the deploy hook reloads the nginx *container* so it picks up the new cert
#
# Link 4 is the sneaky one: if it breaks, certbot renews successfully but nginx
# keeps serving the old cert from memory until something restarts it.

set -uo pipefail          # NOT -e: a failing check should report, not abort

DOMAIN="${DOMAIN:-jacemtg.xyz}"
NGINX_CONTAINER="${NGINX_CONTAINER:-mtgagent-nginx-1}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
RENEWAL_CONF="/etc/letsencrypt/renewal/${DOMAIN}.conf"

ok()   { printf '  \033[32mOK\033[0m    %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$*"; }
info() { printf '        %s\n' "$*"; }
hdr()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

# Collects the one-line fixes so they can be replayed as a summary at the end.
FIXES=()
fix()  { FIXES+=("$*"); }

printf '\033[1mTLS doctor — %s\033[0m  (%s)\n' "$DOMAIN" "$(date -u '+%Y-%m-%d %H:%M UTC')"

# --- 0. Is this even the right box? ------------------------------------------
hdr "0. Host"
info "hostname: $(hostname)   uptime: $(uptime -p 2>/dev/null || echo '?')"
if ! command -v certbot >/dev/null 2>&1; then
  bad "certbot is not on PATH — nothing can be renewing this cert."
  fix "apt install certbot   # or: snap install --classic certbot"
else
  ok "certbot present: $(certbot --version 2>&1 | head -1)"
fi

# --- 1. The cert ON DISK -----------------------------------------------------
# This is what certbot manages. If it is still expired, renewal genuinely
# failed. If it is valid, renewal worked and the problem is downstream (link 4).
hdr "1. Certificate on disk (${LIVE_DIR}/fullchain.pem)"
DISK_VALID=unknown
disk_serial=""
if [[ -r "${LIVE_DIR}/fullchain.pem" ]]; then
  disk_end="$(openssl x509 -in "${LIVE_DIR}/fullchain.pem" -noout -enddate | cut -d= -f2)"
  disk_serial="$(openssl x509 -in "${LIVE_DIR}/fullchain.pem" -noout -serial | cut -d= -f2)"
  info "notAfter: ${disk_end}"
  info "serial:   ${disk_serial}"
  if openssl x509 -in "${LIVE_DIR}/fullchain.pem" -noout -checkend 0 >/dev/null 2>&1; then
    DISK_VALID=yes
    days=$(( ( $(date -d "$disk_end" +%s) - $(date +%s) ) / 86400 ))
    ok "cert on disk is VALID (${days} days left) — certbot's renewal DID work."
  else
    DISK_VALID=no
    bad "cert on disk is EXPIRED — certbot never obtained a replacement."
  fi
else
  bad "cannot read ${LIVE_DIR}/fullchain.pem (missing, or not running as root?)"
fi

# --- 2. The cert nginx is actually SERVING -----------------------------------
# nginx reads the cert once at startup/reload and holds it in memory. A cert
# that is fresh on disk but stale on the wire means the reload hook never ran.
hdr "2. Certificate served by nginx on :443"
served="$(echo | timeout 10 openssl s_client -servername "$DOMAIN" \
            -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate -serial 2>/dev/null)"
if [[ -n "$served" ]]; then
  served_end="$(sed -n 's/^notAfter=//p' <<<"$served")"
  served_serial="$(sed -n 's/^serial=//p' <<<"$served")"
  info "notAfter: ${served_end}"
  info "serial:   ${served_serial}"
  if [[ "$DISK_VALID" == yes && "${served_serial:-x}" != "${disk_serial:-y}" ]]; then
    bad "SERVED cert differs from the one on disk — nginx is holding a stale cert."
    info "This is the whole problem: the renewal worked, the reload did not."
    fix "docker exec ${NGINX_CONTAINER} nginx -s reload"
  elif [[ "$DISK_VALID" == yes ]]; then
    ok "served cert matches disk."
  fi
else
  warn "could not read the served cert from 127.0.0.1:443 (is nginx up?)"
  info "check: docker ps --filter name=${NGINX_CONTAINER}"
fi

# --- 3. Renewal configuration ------------------------------------------------
# The saved authenticator decides HOW renewal proves domain control. `standalone`
# binds port 80 itself — which the nginx container already holds — so it fails
# every single time. `webroot` drops a file into a directory nginx serves, which
# is the only mode that works with this topology.
hdr "3. Renewal config (${RENEWAL_CONF})"
if [[ -r "$RENEWAL_CONF" ]]; then
  auth="$(sed -n 's/^[[:space:]]*authenticator[[:space:]]*=[[:space:]]*//p' "$RENEWAL_CONF" | tail -1)"
  webroot="$(sed -n 's/^[[:space:]]*webroot_path[[:space:]]*=[[:space:]]*//p' "$RENEWAL_CONF" | tail -1)"
  hook="$(sed -n 's/^[[:space:]]*renew_hook[[:space:]]*=[[:space:]]*//p' "$RENEWAL_CONF" | tail -1)"
  info "authenticator = ${auth:-<unset>}"
  info "webroot_path  = ${webroot:-<unset>}"
  info "renew_hook    = ${hook:-<unset>}"

  case "$auth" in
    webroot)
      ok "authenticator is webroot (correct for the containerised nginx)."
      if [[ "$webroot" != *"/var/www/certbot"* ]]; then
        bad "webroot_path is '${webroot}' but nginx serves /var/www/certbot (see deploy/nginx.conf)."
        fix "certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --cert-name ${DOMAIN}"
      fi
      ;;
    standalone)
      bad "authenticator is STANDALONE — it tries to bind :80, which nginx owns."
      info "Every renewal attempt has been failing with 'Could not bind TCP port 80'."
      fix "certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --cert-name ${DOMAIN} \\"
      fix "        --deploy-hook 'docker exec ${NGINX_CONTAINER} nginx -s reload'"
      ;;
    *)
      warn "unexpected authenticator '${auth:-<unset>}' — expected webroot."
      ;;
  esac

  # The deploy hook must name a container that currently exists, or the reload
  # silently no-ops and you get the link-4 failure described above.
  if [[ -z "$hook" ]]; then
    bad "no renew_hook — nginx will not reload after a renewal, so it keeps the old cert."
    fix "certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --cert-name ${DOMAIN} \\"
    fix "        --deploy-hook 'docker exec ${NGINX_CONTAINER} nginx -s reload'"
  else
    hook_container="$(grep -oE 'docker exec [^ ]+' <<<"$hook" | awk '{print $3}')"
    if [[ -n "$hook_container" ]]; then
      if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$hook_container"; then
        ok "renew_hook targets running container '${hook_container}'."
      else
        bad "renew_hook targets '${hook_container}', which is NOT a running container."
        info "running: $(docker ps --format '{{.Names}}' 2>/dev/null | tr '\n' ' ')"
        fix "edit renew_hook in ${RENEWAL_CONF} to the real container name, then re-test"
      fi
    fi
  fi
else
  bad "no renewal config at ${RENEWAL_CONF} — certbot has nothing to renew."
  info "The cert was likely issued one-off with --standalone and never registered."
  fix "certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --cert-name ${DOMAIN} \\"
  fix "        --deploy-hook 'docker exec ${NGINX_CONTAINER} nginx -s reload'"
fi

# --- 4. The scheduler --------------------------------------------------------
# A perfect renewal config renews nothing if no timer ever invokes it. Debian's
# certbot package ships certbot.timer; the snap ships snap.certbot.renew.timer.
hdr "4. Renewal scheduler"
timers="$(systemctl list-timers --all 2>/dev/null | grep -i certbot)"
if [[ -n "$timers" ]]; then
  ok "timer unit exists:"
  info "$timers"
  for unit in certbot.timer snap.certbot.renew.timer; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${unit}"; then
      state="$(systemctl is-enabled "$unit" 2>/dev/null)"
      active="$(systemctl is-active "$unit" 2>/dev/null)"
      if [[ "$state" == enabled && "$active" == active ]]; then
        ok "${unit}: enabled + active"
      else
        bad "${unit}: enabled=${state} active=${active}"
        fix "systemctl enable --now ${unit}"
      fi
    fi
  done
else
  bad "no certbot timer found — nothing is scheduled to renew this cert, ever."
  info "cron fallback? $(ls /etc/cron.d/ 2>/dev/null | grep -i certbot || echo 'none in /etc/cron.d')"
  fix "systemctl enable --now certbot.timer"
fi

# --- 5. What certbot last actually did ---------------------------------------
# The log says which link broke, in certbot's own words. Worth reading even when
# every check above passes.
hdr "5. Recent certbot activity"
if [[ -r /var/log/letsencrypt/letsencrypt.log ]]; then
  info "last run recorded: $(stat -c %y /var/log/letsencrypt/letsencrypt.log 2>/dev/null | cut -d. -f1)"
  errs="$(grep -iE 'error|failed|problem|could not bind|no space' /var/log/letsencrypt/letsencrypt.log 2>/dev/null | tail -8)"
  if [[ -n "$errs" ]]; then
    warn "recent errors in letsencrypt.log:"
    while IFS= read -r l; do info "$l"; done <<<"$errs"
  else
    ok "no obvious errors in letsencrypt.log"
  fi
else
  warn "no /var/log/letsencrypt/letsencrypt.log — certbot may never have run here."
fi
jl="$(journalctl -u certbot --since '-45 days' --no-pager 2>/dev/null | tail -8)"
[[ -n "$jl" ]] && { info '--- journalctl -u certbot (tail) ---'; while IFS= read -r l; do info "$l"; done <<<"$jl"; }

# --- 6. Resources ------------------------------------------------------------
# This droplet has a history of disk and RAM pressure (small disk, 2 GB swapfile
# required for the frontend build). A full disk fails renewal in a way that looks
# unrelated, so rule it out before chasing ACME problems.
hdr "6. Disk and memory"
root_pct="$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')"
info "$(df -h / | tail -1)"
if [[ -n "$root_pct" && "$root_pct" -ge 90 ]]; then
  bad "root filesystem is ${root_pct}% full — this alone can break renewal."
  fix "docker compose down && docker image prune -af && docker compose up -d --build"
else
  ok "root filesystem at ${root_pct:-?}%"
fi
mem="$(free -h 2>/dev/null | sed -n '2p')"
[[ -n "$mem" ]] && info "$mem"
if ! swapon --show 2>/dev/null | grep -q .; then
  warn "no swap active — the frontend build OOM-kills without the 2 GB swapfile."
  fix "swapon -a   # and confirm the swapfile entry is still in /etc/fstab"
else
  ok "swap active"
fi

# --- Summary -----------------------------------------------------------------
hdr "Suggested fixes"
if [[ ${#FIXES[@]} -eq 0 ]]; then
  ok "No broken links found. Confirm the whole path end to end with:"
  info "certbot renew --dry-run"
else
  printf '  Run these in order (as root), then verify:\n\n'
  for f in "${FIXES[@]}"; do printf '    %s\n' "$f"; done
  printf '\n  Then force the overdue renewal and verify:\n\n'
  printf '    certbot renew --force-renewal\n'
  printf '    docker exec %s nginx -s reload\n' "$NGINX_CONTAINER"
  printf '    echo | openssl s_client -servername %s -connect %s:443 2>/dev/null \\\n' "$DOMAIN" "$DOMAIN"
  printf '      | openssl x509 -noout -dates\n'
fi
printf '\n'
