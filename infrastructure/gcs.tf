# GCS bucket for user media storage

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["http://localhost:5173", "https://promptcanvas.com"]
}

resource "google_storage_bucket" "media" {
  name          = "promptcanvas-media-${var.environment}"
  project       = var.project_id
  location      = "US"
  storage_class = "STANDARD"

  autoclass {
    enabled = true
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  cors {
    origin          = var.cors_origins
    method          = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    response_header = ["Content-Type", "Content-Length", "Content-Range"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age              = 7
      matches_prefix   = ["users/"]
      matches_suffix   = ["/previews/images/"]
      send_age_if_zero = true
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age              = 14
      matches_prefix   = ["users/"]
      matches_suffix   = ["/previews/videos/"]
      send_age_if_zero = true
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age              = 30
      matches_prefix   = ["users/"]
      matches_suffix   = ["/generations/"]
      send_age_if_zero = true
    }
    action {
      type = "Delete"
    }
  }

  versioning {
    enabled = false
  }

  labels = {
    environment = var.environment
    app         = "promptcanvas"
    managed-by  = "terraform"
  }
}

resource "google_service_account" "storage_sa" {
  account_id   = "promptcanvas-storage-${var.environment}"
  display_name = "PromptCanvas Storage Service Account"
  project      = var.project_id
}

resource "google_storage_bucket_iam_member" "storage_admin" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.storage_sa.email}"
}

output "bucket_name" {
  value = google_storage_bucket.media.name
}

output "service_account_email" {
  value = google_service_account.storage_sa.email
}
