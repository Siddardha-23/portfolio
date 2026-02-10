# =============================================================================
# CloudFront Distribution for Frontend + API
# =============================================================================

# AWS managed policy IDs (avoids cloudfront:GetCachePolicy/GetOriginRequestPolicy)
locals {
  cloudfront_cache_policy_caching_optimized     = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # Managed-CachingOptimized
  cloudfront_cache_policy_caching_disabled      = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # Managed-CachingDisabled
  cloudfront_origin_request_policy_all_viewer   = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # Managed-AllViewerExceptHostHeader
}

# Security response headers policy
resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${var.project_name}-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    xss_protection {
      mode_block  = true
      protection  = true
      override    = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
      override               = true
    }
  }
}

# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "OAC for Portfolio Frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Portfolio - ${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # North America & Europe only (cheapest)
  
  aliases = [
    var.domain_name,
    "www.${var.domain_name}"
  ]

  # ==========================================================================
  # Origin 1: S3 Frontend
  # ==========================================================================
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-Frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # ==========================================================================
  # Origin 2: API Gateway for Backend
  # ==========================================================================
  origin {
    domain_name = replace(aws_apigatewayv2_api.backend.api_endpoint, "https://", "")
    origin_id   = "API-Backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ==========================================================================
  # Default Behavior: S3 Frontend
  # ==========================================================================
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3-Frontend"
    cache_policy_id            = local.cloudfront_cache_policy_caching_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    viewer_protocol_policy = "redirect-to-https"
  }

  # ==========================================================================
  # API Behavior: /api/* -> Lambda
  # ==========================================================================
  ordered_cache_behavior {
    path_pattern               = "/api/*"
    allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "API-Backend"
    cache_policy_id            = local.cloudfront_cache_policy_caching_disabled
    origin_request_policy_id   = local.cloudfront_origin_request_policy_all_viewer
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    viewer_protocol_policy = "https-only"
  }

  # ==========================================================================
  # Custom Error Responses for SPA Routing
  # ==========================================================================
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # ==========================================================================
  # SSL/TLS Configuration
  # ==========================================================================
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # ==========================================================================
  # Geo Restrictions (None - allow all)
  # ==========================================================================
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ==========================================================================
  # Logging (Optional - reduces cost if disabled)
  # ==========================================================================
  # Uncomment to enable access logging
  # logging_config {
  #   include_cookies = false
  #   bucket          = aws_s3_bucket.logs.bucket_domain_name
  #   prefix          = "cloudfront/"
  # }

  tags = {
    Name = "${var.project_name}-distribution"
  }

  depends_on = [aws_acm_certificate_validation.main]
}

# =============================================================================
# Route 53 DNS Records
# =============================================================================

# Root domain -> CloudFront
resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# www subdomain -> CloudFront
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# IPv6 records
resource "aws_route53_record" "root_ipv6" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_ipv6" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}
