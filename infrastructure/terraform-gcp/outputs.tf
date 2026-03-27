# =============================================================================
# Terraform Outputs
# =============================================================================

output "grafana_external_ip" {
  description = "Static external IP of the Grafana instance"
  value       = google_compute_address.grafana.address
}

output "grafana_url" {
  description = "Grafana web UI URL"
  value       = "http://${google_compute_address.grafana.address}:3000"
}

output "grafana_instance_name" {
  description = "GCE instance name"
  value       = google_compute_instance.grafana.name
}

output "grafana_ssh_command" {
  description = "SSH command to connect to the Grafana instance"
  value       = "gcloud compute ssh ${google_compute_instance.grafana.name} --zone=${var.gcp_zone} --project=${var.gcp_project_id}"
}

output "deployment_summary" {
  description = "Grafana deployment summary"
  value       = <<-EOT

    Grafana Deployment Complete (GCP)
    ==================================

    URL:       http://${google_compute_address.grafana.address}:3000
    Login:     admin / <your grafana_admin_password>

    Instance:  ${google_compute_instance.grafana.name} (e2-micro, always-free tier)
    Zone:      ${var.gcp_zone}
    IP:        ${google_compute_address.grafana.address}

    Pre-configured data sources:
      - CloudWatch (AWS metrics + logs)
      - X-Ray (AWS distributed traces)

    Import dashboards from: infrastructure/grafana/dashboards/
      - lambda-overview.json
      - api-gateway.json
      - logs-explorer.json

  EOT
}
