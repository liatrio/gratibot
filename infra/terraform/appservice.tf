resource "azurerm_service_plan" "gratibot_app_service_plan" {
  name                = "gratibot-${var.environment}-service-plan"
  location            = var.location
  os_type             = "Linux"
  resource_group_name = var.resource_group_name

  sku_name     = var.instance_size
  worker_count = var.instance_capacity
}

resource "azurerm_linux_web_app" "gratibot_app_service" {
  name                    = "gratibot-${var.environment}-service"
  location                = var.location
  resource_group_name     = var.resource_group_name
  service_plan_id         = azurerm_service_plan.gratibot_app_service_plan.id
  https_only              = true
  client_affinity_enabled = true

  logs {
    http_logs {
      file_system {
        retention_in_days = 1
        retention_in_mb   = 35
      }
    }
  }

  site_config {
    always_on         = "true"
    health_check_path = "/health"
    use_32_bit_worker = false
    application_stack {
      docker_image_name   = var.gratibot_image
      docker_registry_url = var.gratibot_image_registry
    }
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    "MONGO_URL"                   = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.mongo_connection_string.id})"
    "APP_TOKEN"                   = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.app_token.id})"
    "BOT_USER_OAUTH_ACCESS_TOKEN" = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.bot_user_token.id})"
    "RECOGNIZE_EMOJI"             = var.gratibot_recognize_emoji
    "REACTION_EMOJI"              = var.gratibot_reaction_emoji
    "LOG_LEVEL"                   = var.gratibot_log_level
    "GRATIBOT_LIMIT"              = var.gratibot_limit
  }
}
