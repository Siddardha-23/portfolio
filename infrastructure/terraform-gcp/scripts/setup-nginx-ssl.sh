#!/bin/bash
set -euo pipefail
exec > /var/log/nginx-ssl-setup.log 2>&1
set -x

DOMAIN="grafana.manneharshithsiddardha.com"

echo "Installing Nginx and Certbot..."
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/grafana <<'NGINXEOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name grafana.manneharshithsiddardha.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/live/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/grafana /etc/nginx/sites-enabled/grafana
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
echo "Nginx configured"

echo "Requesting Let's Encrypt certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email harshith.siddardha@gmail.com --redirect

echo "Setting up auto-renewal..."
systemctl enable certbot.timer 2>/dev/null || true

echo "Configuring Grafana domain..."
sed -i "s|^;domain = localhost|domain = $DOMAIN|" /etc/grafana/grafana.ini
sed -i "s|^;root_url = .*|root_url = https://$DOMAIN/|" /etc/grafana/grafana.ini
systemctl restart grafana-server

echo "Setup complete! Access Grafana at https://$DOMAIN"
