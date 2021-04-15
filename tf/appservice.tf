resource "azurerm_app_service_plan" "gratibot_app_service_plan" {
  name                = "gratibot-${var.environment}-service-plan"
  location            = var.location
  resource_group_name = var.resource_group_name
  kind                = "Linux"
  reserved            = true

  sku {
    tier     = var.instance_tier
    size     = var.instance_size
    capacity = var.instance_capacity
  }
}

resource "azurerm_app_service" "gratibot_app_service" {
  name                    = "gratibot-${var.environment}-service"
  location                = var.location
  resource_group_name     = var.resource_group_name
  app_service_plan_id     = azurerm_app_service_plan.gratibot_app_service_plan.id
  https_only              = true
  client_affinity_enabled = true

  site_config {
    always_on        = "true"
    linux_fx_version = "DOCKER|${var.gratibot_image}"
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    "MONGO_URL"                   = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.mongo_connection_string.id})"
    "SIGNING_SECRET"              = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.signing_secret.id})"
    "BOT_USER_OAUTH_ACCESS_TOKEN" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.bot_user_token.id})"
    "RECOGNIZE_EMOJI"             = var.gratibot_recognize_emoji
    "REACTION_EMOJI"              = var.gratibot_reaction_emoji
  }
}
