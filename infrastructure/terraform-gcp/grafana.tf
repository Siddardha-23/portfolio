# =============================================================================
# GCE Instance - Grafana Server
# =============================================================================
# e2-micro: 2 vCPU (shared), 1 GB memory — always-free in us-west1/us-central1/us-east1
# =============================================================================

resource "google_compute_address" "grafana" {
  name   = "${var.project_name}-grafana-ip"
  region = var.gcp_region
}

resource "google_compute_instance" "grafana" {
  name         = "${var.project_name}-grafana"
  machine_type = "e2-micro"
  zone         = var.gcp_zone

  tags = ["grafana-server"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 10
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.grafana.address
    }
  }

  metadata_startup_script = replace(templatefile("${path.module}/scripts/grafana-startup.sh", {
    grafana_admin_password = var.grafana_admin_password
    aws_access_key_id      = var.aws_access_key_id
    aws_secret_access_key  = var.aws_secret_access_key
    aws_region             = var.aws_region
  }), "\r", "")

  labels = {
    project = var.project_name
    role    = "monitoring"
  }

  scheduling {
    preemptible       = false
    automatic_restart = true
  }

  service_account {
    scopes = ["logging-write", "monitoring-write"]
  }
}

# =============================================================================
# Firewall Rules
# =============================================================================

resource "google_compute_firewall" "grafana_http" {
  name    = "${var.project_name}-grafana-allow-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["3000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["grafana-server"]
  description   = "Allow Grafana web UI access on port 3000"
}

resource "google_compute_firewall" "grafana_ssh" {
  name    = "${var.project_name}-grafana-allow-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["grafana-server"]
  description   = "Allow SSH for instance management"
}

resource "google_compute_firewall" "grafana_https" {
  name    = "${var.project_name}-grafana-allow-https"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["grafana-server"]
  description   = "Allow HTTP/HTTPS for Nginx reverse proxy + Let's Encrypt"
}
