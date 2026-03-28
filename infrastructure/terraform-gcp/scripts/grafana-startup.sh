#!/bin/bash

exec > /var/log/grafana-startup.log 2>&1
set -x

GRAFANA_ADMIN_PASSWORD="${grafana_admin_password}"
AWS_ACCESS_KEY="${aws_access_key_id}"
AWS_SECRET_KEY="${aws_secret_access_key}"
AWS_REGION="${aws_region}"

if systemctl is-active --quiet grafana-server 2>/dev/null; then
  echo "Grafana already running, skipping install"
  exit 0
fi

echo "Installing Grafana OSS..."

apt-get update -y
apt-get install -y apt-transport-https software-properties-common wget gnupg2

wget -q -O /usr/share/keyrings/grafana.key https://apt.grafana.com/gpg.key
echo "deb [signed-by=/usr/share/keyrings/grafana.key] https://apt.grafana.com stable main" \
  | tee /etc/apt/sources.list.d/grafana.list

apt-get update -y
apt-get install -y grafana

sed -i "s/^;admin_password = admin/admin_password = $GRAFANA_ADMIN_PASSWORD/" /etc/grafana/grafana.ini

echo "Installing X-Ray plugin..."
grafana-cli plugins install grafana-x-ray-datasource

echo "Provisioning data sources..."
mkdir -p /etc/grafana/provisioning/datasources
cat > /etc/grafana/provisioning/datasources/aws-cloudwatch.yaml <<DSEOF
apiVersion: 1
datasources:
  - name: CloudWatch
    type: cloudwatch
    uid: P034F075C744B399F
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
    uid: xray-datasource
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

echo "Configuring dashboard provisioning..."
mkdir -p /etc/grafana/provisioning/dashboards
cat > /etc/grafana/provisioning/dashboards/portfolio.yaml <<DPEOF
apiVersion: 1
providers:
  - name: Portfolio
    orgId: 1
    folder: Portfolio
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
DPEOF

chown -R grafana:grafana /etc/grafana/provisioning/dashboards/

echo "Creating dashboard directory..."
mkdir -p /var/lib/grafana/dashboards
chown -R grafana:grafana /var/lib/grafana/dashboards/

echo "Starting Grafana..."
systemctl daemon-reload
systemctl enable grafana-server
systemctl start grafana-server

echo "Grafana startup complete"
echo ""
echo "Dashboards can be provisioned by placing JSON files in /var/lib/grafana/dashboards/"
echo "Or import them via the Grafana UI: Dashboards > Import > Upload JSON"
