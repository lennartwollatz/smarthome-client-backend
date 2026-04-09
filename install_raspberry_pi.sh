#!/usr/bin/env bash
set -euo pipefail

# Raspberry Pi SmartHome Setup Script
# - Interaktive Parameterabfrage
# - Automatisierte Installation/Build/Hardening-Teile
# - Manuelle Stop-Punkte fuer Fritzbox, No-IP und GitHub Webhook

STATE_DIR="$HOME/.smarthome-install"
STATE_FILE="$STATE_DIR/state.env"
LOG_FILE="$STATE_DIR/install.log"

mkdir -p "$STATE_DIR"
touch "$LOG_FILE"

exec > >(tee -a "$LOG_FILE") 2>&1

PHASE_START="${1:-all}"

phase_num() {
  case "$1" in
    prep) echo 0 ;;
    phase1) echo 1 ;;
    phase2) echo 2 ;;
    phase3) echo 3 ;;
    phase4) echo 4 ;;
    phase5) echo 5 ;;
    phase6) echo 6 ;;
    phase7) echo 7 ;;
    phase8) echo 8 ;;
    phase9) echo 9 ;;
    phase10) echo 10 ;;
    *) echo 999 ;;
  esac
}

START_NUM=$(phase_num "$PHASE_START")

run_from() {
  local n
  n=$(phase_num "$1")
  [ "$START_NUM" -le "$n" ]
}

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
err()  { echo "[ERR ] $*"; }

pause_for_user() {
  echo
  echo "==== MANUELLER SCHRITT ERFORDERLICH ===="
  echo "$1"
  echo "========================================="
  read -r -p "Wenn erledigt, Enter druecken... " _
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    err "Befehl '$1' nicht gefunden."
    exit 1
  }
}

save_state() {
  cat > "$STATE_FILE" <<EOF
PI_USER=${PI_USER}
REPO_URL=${REPO_URL}
DEPLOY_BRANCH=${DEPLOY_BRANCH}
DYNDNS_DOMAIN=${DYNDNS_DOMAIN}
CERTBOT_EMAIL=${CERTBOT_EMAIL}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
DEPLOY_MODE=${DEPLOY_MODE}
EOF
  chmod 600 "$STATE_FILE"
}

load_state_if_exists() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    source "$STATE_FILE"
  fi
}

read_with_default() {
  local var_name="$1"
  local prompt="$2"
  local default_val="$3"
  local current_val="${!var_name:-}"
  local input

  if [ -n "$current_val" ]; then
    read -r -p "$prompt [$current_val]: " input || true
    if [ -n "$input" ]; then
      printf -v "$var_name" '%s' "$input"
    fi
  else
    read -r -p "$prompt [$default_val]: " input || true
    if [ -n "$input" ]; then
      printf -v "$var_name" '%s' "$input"
    else
      printf -v "$var_name" '%s' "$default_val"
    fi
  fi
}

confirm_or_exit() {
  local answer
  read -r -p "Fortfahren? (yes/no): " answer
  if [ "$answer" != "yes" ]; then
    warn "Abgebrochen durch Benutzer."
    exit 1
  fi
}

prompt_parameters() {
  info "Parameterabfrage"
  echo "Hinweise:"
  echo "- REPO_URL findest du in GitHub unter: Repo > Code > HTTPS"
  echo "- DYNDNS_DOMAIN erstellst du bei noip.com unter Dynamic DNS > Create Hostname"
  echo "- CERTBOT_EMAIL ist deine E-Mail fuer Zertifikatsablauf-Hinweise"
  echo

  PI_USER="${PI_USER:-$(whoami)}"
  read_with_default PI_USER "Linux-Benutzer auf dem Pi" "$PI_USER"
  read_with_default REPO_URL "Repository URL (enthaelt backend + frontend)" "https://github.com/<user>/<repo>.git"
  read_with_default DEPLOY_BRANCH "Branch fuer Deploy" "main"
  read_with_default DYNDNS_DOMAIN "DynDNS Domain" "mein-smarthome.ddns.net"
  read_with_default CERTBOT_EMAIL "E-Mail fuer Certbot" "admin@example.com"
  read_with_default DEPLOY_MODE "Deploy-Modus (webhook|polling)" "webhook"

  if [ "$DEPLOY_MODE" != "webhook" ] && [ "$DEPLOY_MODE" != "polling" ]; then
    err "Ungueltiger Deploy-Modus: $DEPLOY_MODE (erlaubt: webhook|polling)"
    exit 1
  fi

  if [ -z "${WEBHOOK_SECRET:-}" ]; then
    WEBHOOK_SECRET="$(openssl rand -hex 32)"
    info "Webhook Secret automatisch erzeugt."
  fi

  echo
  echo "Verwendete Parameter:"
  echo "- PI_USER                : $PI_USER"
  echo "- REPO_URL               : $REPO_URL"
  echo "- DEPLOY_BRANCH          : $DEPLOY_BRANCH"
  echo "- DYNDNS_DOMAIN          : $DYNDNS_DOMAIN"
  echo "- CERTBOT_EMAIL          : $CERTBOT_EMAIL"
  echo "- DEPLOY_MODE            : $DEPLOY_MODE"
  echo "- WEBHOOK_SECRET         : $WEBHOOK_SECRET"
  echo

  confirm_or_exit
  save_state
}

ensure_prerequisites() {
  require_cmd sudo
  require_cmd bash
  require_cmd curl
  require_cmd openssl
}

phase1_system_setup() {
  info "Phase 1: Systemgrundlagen"
  sudo apt -qq update && sudo apt -qq upgrade -y
  sudo apt -qq install -y build-essential python3 python3-pip git curl jq

  if [ -f /etc/dphys-swapfile ]; then
    sudo dphys-swapfile swapoff || true
    sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
  else
    warn "/etc/dphys-swapfile nicht gefunden, Swap-Anpassung uebersprungen."
  fi
}

phase2_node_install() {
  info "Phase 2: Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo apt -qq install -y nodejs
  node -v
  npm -v
}

clone_or_update_repo() {
  local target_dir="$1"
  local repo_url="$2"
  local branch="$3"

  mkdir -p "$target_dir"
  if [ -d "$target_dir/.git" ]; then
    info "Aktualisiere Repo in $target_dir"
    cd "$target_dir"
    git remote remove origin >/dev/null 2>&1 || true
    git remote add origin "$repo_url"
    git fetch origin "$branch"
    git checkout -B "$branch" "origin/$branch"
  else
    info "Klone Repo nach $target_dir"
    rm -rf "$target_dir"
    git clone "$repo_url" "$target_dir"
    cd "$target_dir"
    git checkout "$branch" || true
  fi
}

phase3_clone_repo() {
  info "Phase 3: Projektdateien bereitstellen (Git)"
  mkdir -p "$HOME/smarthome"
  if [ -d "$HOME/smarthome/.git" ]; then
    clone_or_update_repo "$HOME/smarthome" "$REPO_URL" "$DEPLOY_BRANCH"
  else
    if [ -n "$(ls -A "$HOME/smarthome" 2>/dev/null)" ]; then
      warn "$HOME/smarthome ist nicht leer und kein Git-Repo. Ueberspringe Clone."
      warn "Falls du per SCP kopiert hast, ist das korrekt."
    else
      git clone "$REPO_URL" "$HOME/smarthome"
      cd "$HOME/smarthome"
      git checkout "$DEPLOY_BRANCH" || true
    fi
  fi
}

patch_backend_localhost_bind() {
  local index_file="$HOME/smarthome/smarthome-client-backend/src/main/node/com/smarthome/backend/index.ts"
  if [ ! -f "$index_file" ]; then
    warn "Backend index.ts nicht gefunden: $index_file"
    return
  fi

  if grep -q 'listen(port, "127.0.0.1"' "$index_file"; then
    info "Backend ist bereits auf 127.0.0.1 gebunden."
    return
  fi

  info "Setze Backend-Bindung auf 127.0.0.1"
  sed -i 's/listen(port, ()/listen(port, "127.0.0.1", ()/g' "$index_file"
}

phase4_backend_build() {
  info "Phase 4: Backend installieren und bauen"
  cd "$HOME/smarthome/smarthome-client-backend/src/main/node"
  npm install --loglevel=error
  npm run build

  mkdir -p "$HOME/smarthome/smarthome-client-backend/src/main/node/data"

  cat > "$HOME/smarthome/smarthome-client-backend/src/main/node/.env" <<EOF
PORT=4040
DB_URL=data/smarthomeNew.sqlite
ML_DB_URL=data/ml.sqlite
LOG_LEVEL=warn
EOF

  patch_backend_localhost_bind
  npm run build

  info "Backend Kurztest (npm run start, 8 Sekunden)"
  timeout 8s npm run start >/dev/null 2>&1 || true
}

phase5_frontend_build() {
  info "Phase 5: Frontend bauen"
  cd "$HOME/smarthome/smarthome-client-frontend"
  npm install --loglevel=error
  npx ng build --configuration production --progress=false
}

write_nginx_config() {
  local pi_home="/home/$PI_USER"
  sudo tee /etc/nginx/sites-available/smarthome >/dev/null <<EOF
# Rate Limiting
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;

# ===========================================
# Server 1: Lokales Netzwerk (HTTP, Port 80)
# Frontend + API + WebSocket
# ===========================================
server {
    listen 80;
    server_name _;

    access_log off;
    error_log /var/log/nginx/smarthome-error.log error;
    server_tokens off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 127.0.0.1;
    deny all;

    root ${pi_home}/smarthome/smarthome-client-frontend/dist/smarthome-client-frontend/browser;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:4040;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:4040;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}

# ===========================================
# Server 2: ACME Challenge (HTTP, Port 80)
# ===========================================
server {
    listen 80;
    server_name ${DYNDNS_DOMAIN};

    access_log off;
    error_log /var/log/nginx/acme-error.log error;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 403;
    }
}

# ===========================================
# Server 3: GitHub Webhook (HTTPS, Port 443)
# ===========================================
server {
    listen 443 ssl;
    server_name ${DYNDNS_DOMAIN};

    access_log off;
    error_log /var/log/nginx/webhook-error.log error;
    server_tokens off;

    ssl_certificate /etc/ssl/certs/smarthome.crt;
    ssl_certificate_key /etc/ssl/private/smarthome.key;

    location /hooks/ {
        include /etc/nginx/snippets/github-ips.conf;

        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location / {
        return 403;
    }
}
EOF
}

phase6_nginx_setup() {
  info "Phase 6: nginx"
  sudo apt -qq install -y nginx

  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/smarthome.key \
    -out /etc/ssl/certs/smarthome.crt \
    -subj "/CN=smarthome" 2>/dev/null

  write_nginx_config

  sudo mkdir -p /etc/nginx/snippets /var/www/certbot
  sudo tee /etc/nginx/snippets/github-ips.conf >/dev/null <<'EOF'
# GitHub Webhook IP-Ranges (initial)
allow 140.82.112.0/20;
allow 185.199.108.0/22;
allow 192.30.252.0/22;
allow 143.55.64.0/20;
deny all;
EOF

  sudo ln -sf /etc/nginx/sites-available/smarthome /etc/nginx/sites-enabled/smarthome
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl restart nginx
  sudo systemctl enable nginx
}

phase7_pm2_setup() {
  info "Phase 7: PM2"
  sudo npm install -g pm2 --loglevel=error
  cd "$HOME/smarthome/smarthome-client-backend/src/main/node"

  pm2 delete smarthome-backend >/dev/null 2>&1 || true
  pm2 start dist/com/smarthome/backend/index.js --name smarthome-backend --merge-logs --log-date-format "YYYY-MM-DD HH:mm:ss"
  pm2 save

  local startup_cmd
  startup_cmd="$(pm2 startup systemd -u "$PI_USER" --hp "/home/$PI_USER" | grep -E '^sudo .+pm2.+startup' || true)"
  if [ -n "$startup_cmd" ]; then
    eval "$startup_cmd"
  else
    warn "PM2 startup command konnte nicht automatisch extrahiert werden. Bitte 'pm2 startup' manuell pruefen."
  fi

  pm2 status
}

phase8_smoke_tests() {
  info "Phase 8: Smoke-Tests"
  local pi_ip
  pi_ip="$(hostname -I | awk '{print $1}')"
  echo "PI IP erkannt: ${pi_ip}"

  if curl -sSf http://127.0.0.1/api/settings >/dev/null; then
    info "API-Test localhost OK"
  else
    warn "API-Test localhost fehlgeschlagen (evtl. Endpoint abweichend)."
  fi

  if nc -z 127.0.0.1 4040 >/dev/null 2>&1; then
    info "Backend Port 4040 lokal offen (erwartet)."
  else
    warn "Backend Port 4040 lokal nicht offen."
  fi
}

write_deploy_script() {
  cat > "$HOME/smarthome/deploy.sh" <<EOF
#!/bin/bash
set -e

LOGFILE="/var/log/smarthome-deploy.log"
exec >> "\$LOGFILE" 2>&1
echo "========== Deploy gestartet: \$(date) =========="

echo "[1/6] Git pull..."
cd "$HOME/smarthome"
git pull --ff-only origin "$DEPLOY_BRANCH"

echo "[2/6] Backend: npm install..."
cd "$HOME/smarthome/smarthome-client-backend/src/main/node"
npm install --loglevel=error

echo "[3/6] Backend: TypeScript kompilieren..."
npm run build

echo "[4/6] Backend: PM2 neustarten..."
pm2 restart smarthome-backend

echo "[5/6] Frontend: npm install..."
cd "$HOME/smarthome/smarthome-client-frontend"
npm install --loglevel=error

echo "[6/6] Frontend: Angular Build..."
npx ng build --configuration production --progress=false

echo "========== Deploy abgeschlossen: \$(date) =========="
EOF

  chmod +x "$HOME/smarthome/deploy.sh"
  sudo touch /var/log/smarthome-deploy.log
  sudo chown "$PI_USER:$PI_USER" /var/log/smarthome-deploy.log
}

write_webhook_files() {
  mkdir -p "$HOME/webhook"

  cat > "$HOME/webhook/hooks.json" <<EOF
[
  {
    "id": "deploy-smarthome",
    "execute-command": "/home/${PI_USER}/smarthome/deploy.sh",
    "command-working-directory": "/home/${PI_USER}/smarthome",
    "pass-arguments-to-command": [],
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "${WEBHOOK_SECRET}",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/${DEPLOY_BRANCH}",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
EOF

  sudo tee /etc/systemd/system/webhook.service >/dev/null <<EOF
[Unit]
Description=Webhook Deploy Listener
After=network.target

[Service]
Type=simple
User=${PI_USER}
ExecStart=/usr/bin/webhook -hooks /home/${PI_USER}/webhook/hooks.json -ip 127.0.0.1 -port 9000 -verbose=false -hotreload
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable --now webhook
}

write_github_ip_update_script() {
  cat > "$HOME/smarthome/update-github-ips.sh" <<'EOF'
#!/bin/bash
set -e

LOGFILE="/var/log/github-ip-update.log"
CONF="/etc/nginx/snippets/github-ips.conf"
TMPFILE=$(mktemp)

exec >> "$LOGFILE" 2>&1
echo "========== $(date) =========="

RESPONSE=$(curl -s --max-time 30 https://api.github.com/meta)

if [ -z "$RESPONSE" ]; then
  echo "FEHLER: Keine Antwort von api.github.com"
  rm -f "$TMPFILE"
  exit 1
fi

echo "$RESPONSE" | jq -r '.hooks[]' > /dev/null 2>&1 || {
  echo "FEHLER: JSON-Parsing fehlgeschlagen"
  rm -f "$TMPFILE"
  exit 1
}

{
  echo "# GitHub Webhook IP-Ranges"
  echo "# Automatisch aktualisiert: $(date)"
  echo "$RESPONSE" | jq -r '.hooks[]' | while read -r cidr; do
    echo "allow ${cidr};"
  done
  echo "deny all;"
} > "$TMPFILE"

if [ -f "$CONF" ] && diff -q "$CONF" "$TMPFILE" > /dev/null 2>&1; then
  echo "Keine Aenderungen"
  rm -f "$TMPFILE"
  exit 0
fi

echo "Aenderungen erkannt, aktualisiere nginx-Config..."
sudo cp "$TMPFILE" "$CONF"
rm -f "$TMPFILE"

if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  echo "nginx erfolgreich neu geladen"
else
  echo "FEHLER: nginx-Config ungueltig!"
  exit 1
fi
EOF

  chmod +x "$HOME/smarthome/update-github-ips.sh"
  sudo touch /var/log/github-ip-update.log
  sudo chown "$PI_USER:$PI_USER" /var/log/github-ip-update.log
}

append_cron_if_missing() {
  local line="$1"
  (crontab -l 2>/dev/null | grep -Fv "$line"; echo "$line") | crontab -
}

phase9_cicd() {
  info "Phase 9: CI/CD"
  cd "$HOME/smarthome"
  if [ ! -d "$HOME/smarthome/.git" ]; then
    git init
  fi
  git remote remove origin >/dev/null 2>&1 || true
  git remote add origin "$REPO_URL"
  git fetch origin "$DEPLOY_BRANCH"
  git checkout -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"

  write_deploy_script

  if [ "$DEPLOY_MODE" = "webhook" ]; then
    sudo apt -qq install -y webhook
    write_webhook_files
  else
    info "Deploy-Modus polling aktiv: Webhook-Installation wird uebersprungen."
    append_cron_if_missing "*/5 * * * * cd $HOME/smarthome && git fetch --quiet origin $DEPLOY_BRANCH && [ \"\$(git rev-parse HEAD)\" != \"\$(git rev-parse origin/$DEPLOY_BRANCH)\" ] && $HOME/smarthome/deploy.sh"
  fi

  sudo apt -qq install -y ufw
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow from 192.168.0.0/16 to any port 22
  sudo ufw allow from 10.0.0.0/8 to any port 22
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw deny 9000
  sudo ufw --force enable

  write_github_ip_update_script
  "$HOME/smarthome/update-github-ips.sh" || warn "Initiales GitHub-IP-Update fehlgeschlagen."
  append_cron_if_missing "0 3 * * 0 $HOME/smarthome/update-github-ips.sh"

  if [ "$DEPLOY_MODE" = "webhook" ]; then
    echo
    echo "GitHub Webhook Parameter (fuer manuelle Einrichtung):"
    echo "  URL    : https://${DYNDNS_DOMAIN}/hooks/deploy-smarthome"
    echo "  Secret : ${WEBHOOK_SECRET}"
    echo "  Event  : Just the push event"
    echo "  Branch : ${DEPLOY_BRANCH}"
  fi
}

phase10_hardening() {
  info "Phase 10: Hardening"

  # SSH haerten
  sudo cp /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%s)"
  sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
  sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sudo sed -i 's/^#\?PubkeyAuthentication .*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
  sudo sed -i 's/^#\?MaxAuthTries .*/MaxAuthTries 3/' /etc/ssh/sshd_config
  sudo sed -i 's/^#\?LoginGraceTime .*/LoginGraceTime 30/' /etc/ssh/sshd_config

  if grep -q '^AllowUsers ' /etc/ssh/sshd_config; then
    sudo sed -i "s/^AllowUsers .*/AllowUsers ${PI_USER}/" /etc/ssh/sshd_config
  else
    echo "AllowUsers ${PI_USER}" | sudo tee -a /etc/ssh/sshd_config >/dev/null
  fi

  sudo systemctl restart sshd || sudo systemctl restart ssh || true

  # Fail2ban
  sudo apt -qq install -y fail2ban
  sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/smarthome-error.log
EOF
  sudo systemctl enable fail2ban
  sudo systemctl restart fail2ban

  # Unattended upgrades
  sudo apt -qq install -y unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades

  # Certbot
  sudo apt -qq install -y certbot python3-certbot-nginx
  sudo certbot --nginx --non-interactive --agree-tos -m "$CERTBOT_EMAIL" -d "$DYNDNS_DOMAIN" || warn "Certbot konnte nicht vollstaendig abgeschlossen werden (oft wegen DNS/Port-Forwarding)."

  sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  sudo tee /etc/letsencrypt/renewal-hooks/deploy/99-reload-nginx.sh >/dev/null <<'EOF'
#!/bin/bash
systemctl reload nginx
EOF
  sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/99-reload-nginx.sh

  sudo systemctl list-timers | grep certbot || warn "certbot.timer nicht sichtbar."
  sudo certbot renew --dry-run || warn "certbot dry-run fehlgeschlagen (oft bei DNS/Port-Freigabe noch nicht fertig)."

  # Dateiberechtigungen
  chmod 600 "$HOME/smarthome/smarthome-client-backend/src/main/node/.env" || true
  chmod 700 "$HOME/smarthome/deploy.sh" || true
  chmod 700 "$HOME/smarthome/update-github-ips.sh" || true
  chmod 600 "$HOME/webhook/hooks.json" || true
  chmod 600 "$HOME/smarthome/smarthome-client-backend/src/main/resources/application.properties" || true
  chmod 600 "$HOME/smarthome/smarthome-client-backend/src/main/node/data"/*.sqlite 2>/dev/null || true

  # Swap zuruecksetzen
  if [ -f /etc/dphys-swapfile ]; then
    sudo dphys-swapfile swapoff || true
    sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=256/' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
  fi
}

manual_checkpoints() {
  pause_for_user "No-IP Konto + Hostname anlegen: https://www.noip.com\nPfad: Dynamic DNS > Create Hostname\nBeispiel: ${DYNDNS_DOMAIN}"

  pause_for_user "Fritzbox konfigurieren:\n1) Internet > Freigaben > DynDNS (No-IP Daten eintragen)\n2) Portfreigaben: 443/TCP und 80/TCP auf den Pi\n3) Danach DNS pruefen: dig +short ${DYNDNS_DOMAIN}"

  if [ "$DEPLOY_MODE" = "webhook" ]; then
    pause_for_user "GitHub Webhook manuell anlegen:\nRepo > Settings > Webhooks > Add webhook\nURL: https://${DYNDNS_DOMAIN}/hooks/deploy-smarthome\nSecret: ${WEBHOOK_SECRET}\nEvent: Just the push event"
  else
    info "Deploy-Modus polling: Kein externer Webhook noetig."
  fi
}

print_summary() {
  echo
  echo "==============================================="
  echo "Installation abgeschlossen (mit manuellen Schritten)."
  echo "Logdatei: $LOG_FILE"
  echo "State   : $STATE_FILE"
  echo
  echo "Wichtige Werte:"
  echo "- DynDNS Domain : $DYNDNS_DOMAIN"
  echo "- Deploy-Modus          : $DEPLOY_MODE"
  echo "- Webhook URL           : https://$DYNDNS_DOMAIN/hooks/deploy-smarthome"
  echo "- Webhook Secret        : $WEBHOOK_SECRET"
  echo
  echo "Empfohlene Checks:"
  echo "- pm2 status"
  echo "- sudo nginx -t"
  echo "- sudo ufw status"
  echo "- sudo systemctl status webhook"
  echo "- sudo systemctl list-timers | grep certbot"
  echo "==============================================="
}

main() {
  load_state_if_exists
  ensure_prerequisites

  if [ "$PHASE_START" = "all" ] || [ "$PHASE_START" = "prep" ]; then
    prompt_parameters
  fi

  if run_from phase1; then phase1_system_setup; fi
  if run_from phase2; then phase2_node_install; fi
  if run_from phase3; then phase3_clone_repo; fi
  if run_from phase4; then phase4_backend_build; fi
  if run_from phase5; then phase5_frontend_build; fi
  if run_from phase6; then phase6_nginx_setup; fi
  if run_from phase7; then phase7_pm2_setup; fi
  if run_from phase8; then phase8_smoke_tests; fi

  if run_from phase9; then
    phase9_cicd
    manual_checkpoints
  fi

  if run_from phase10; then phase10_hardening; fi

  print_summary
}

main "$@"
