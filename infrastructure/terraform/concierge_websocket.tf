###############################################################################
# Concierge WebSocket API
#
# A separate API Gateway WebSocket API that routes $connect / $disconnect /
# $default to the existing chat Lambda. The Lambda detects WS events by
# requestContext.routeKey and dispatches to websocket_handler.handle. A
# DynamoDB table tracks active connections (TTL-cleaned every hour).
#
# The CloudFront distribution should be updated to forward /ws/* to the
# wss:// endpoint output below, or the frontend can target the WebSocket
# domain directly via VITE_CONCIERGE_WS_URL.
###############################################################################

resource "aws_apigatewayv2_api" "concierge_ws" {
  name                       = "${var.project_name}-concierge-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.type"
  description                = "Concierge low-latency WebSocket channel — routes to the chat Lambda"
}

# ----- Connection store (single-table, TTL-cleaned) ---------------------------
resource "aws_dynamodb_table" "concierge_ws_connections" {
  name         = "${var.project_name}-concierge-ws-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connection_id"

  attribute {
    name = "connection_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery { enabled = false }

  tags = {
    Project = var.project_name
    Service = "concierge-ws"
  }
}

# ----- Integration: every route → chat Lambda --------------------------------
resource "aws_apigatewayv2_integration" "concierge_ws" {
  api_id                    = aws_apigatewayv2_api.concierge_ws.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.service["chat"].invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
  passthrough_behavior      = "WHEN_NO_MATCH"
  integration_method        = "POST"
}

resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.concierge_ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.concierge_ws.id}"
}

resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.concierge_ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.concierge_ws.id}"
}

resource "aws_apigatewayv2_route" "ws_default" {
  api_id    = aws_apigatewayv2_api.concierge_ws.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.concierge_ws.id}"
}

# ----- Stage (auto-deploy) ---------------------------------------------------
resource "aws_apigatewayv2_stage" "concierge_ws" {
  api_id      = aws_apigatewayv2_api.concierge_ws.id
  name        = "prod"
  auto_deploy = true

  # NOTE: logging_level + data_trace_enabled are intentionally omitted.
  # Setting them on a v2 stage requires `aws_api_gateway_account` to have a
  # CloudWatch Logs role ARN at the account level — a one-time bootstrap most
  # AWS accounts don't have configured. The Lambda already emits structured
  # logs to its own CloudWatch log group, so stage-level access logs are not
  # needed. If you later want them, add this block back AFTER setting up
  # `aws_api_gateway_account.main.cloudwatch_role_arn` once per account.
  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 25
  }

  tags = {
    Project = var.project_name
    Service = "concierge-ws"
  }
}

# ----- Permission: API Gateway invokes the chat Lambda -----------------------
resource "aws_lambda_permission" "concierge_ws_invoke" {
  statement_id  = "AllowAPIGatewayWSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.service["chat"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.concierge_ws.execution_arn}/*/*"
}

# ----- IAM: chat Lambda → manage WS connections + DDB connection store -------
resource "aws_iam_role_policy" "concierge_ws" {
  name = "${var.project_name}-concierge-ws-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections",
        ]
        Resource = "${aws_apigatewayv2_api.concierge_ws.execution_arn}/*/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
        ]
        Resource = aws_dynamodb_table.concierge_ws_connections.arn
      },
    ]
  })
}

# ----- Wire env vars into the chat Lambda so it can find DDB + WS endpoint ---
# NOTE: The chat Lambda's env block lives in `lambda.tf` under the `chat`
# service map. Add WS_CONNECTIONS_TABLE there pointing at this table:
#
#   chat = {
#     ...
#     env_vars = {
#       ...existing vars...
#       WS_CONNECTIONS_TABLE = aws_dynamodb_table.concierge_ws_connections.name
#     }
#   }
#
# Done as a separate edit to keep this file self-contained.

# ----- Outputs ---------------------------------------------------------------
output "concierge_ws_endpoint" {
  description = "wss:// endpoint for the Concierge — set as VITE_CONCIERGE_WS_URL in the frontend"
  value       = "${aws_apigatewayv2_api.concierge_ws.api_endpoint}/${aws_apigatewayv2_stage.concierge_ws.name}"
}

output "concierge_ws_connections_table" {
  description = "DynamoDB table name for active WebSocket connections"
  value       = aws_dynamodb_table.concierge_ws_connections.name
}
