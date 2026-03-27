#!/bin/bash
set -euo pipefail

GRAFANA_ADMIN_PASSWORD="${grafana_admin_password}"
AWS_ACCESS_KEY="${aws_access_key_id}"
AWS_SECRET_KEY="${aws_secret_access_key}"
AWS_REGION="${aws_region}"

# Skip if Grafana is already installed (idempotent on reboot)
if systemctl is-active --quiet grafana-server 2>/dev/null; then
  exit 0
fi

# Install Grafana OSS
apt-get update -y
apt-get install -y apt-transport-https software-properties-common wget gnupg2

wget -q -O /usr/share/keyrings/grafana.key https://apt.grafana.com/gpg.key
echo "deb [signed-by=/usr/share/keyrings/grafana.key] https://apt.grafana.com stable main" \
  | tee /etc/apt/sources.list.d/grafana.list

apt-get update -y
apt-get install -y grafana

# Set admin password
sed -i "s/^;admin_password = admin/admin_password = $GRAFANA_ADMIN_PASSWORD/" /etc/grafana/grafana.ini

# Install CloudWatch and X-Ray plugins
grafana-cli plugins install grafana-x-ray-datasource

# Provision CloudWatch data source
mkdir -p /etc/grafana/provisioning/datasources
cat > /etc/grafana/provisioning/datasources/aws-cloudwatch.yaml <<DSEOF
apiVersion: 1
datasources:
  - name: CloudWatch
    type: cloudwatch
    access: proxy
    isDefault: true
    jsonData:
      authType: keys
      defaultRegion: $AWS_REGION
    secureJsonData:
      accessKey: "$AWS_ACCESS_KEY"
      secretKey: "$AWS_SECRET_KEY"
    editable: true

  - name: X-Ray
    type: grafana-x-ray-datasource
    access: proxy
    jsonData:
      authType: keys
      defaultRegion: $AWS_REGION
    secureJsonData:
      accessKey: "$AWS_ACCESS_KEY"
      secretKey: "$AWS_SECRET_KEY"
    editable: true
DSEOF

chown -R grafana:grafana /etc/grafana/provisioning/datasources/

# Enable and start Grafana
systemctl daemon-reload
systemctl enable grafana-server
systemctl start grafana-server
