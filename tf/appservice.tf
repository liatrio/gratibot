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

  app_settings = {
    "MONGO_URL"                   = azurerm_cosmosdb_account.db_account.connection_strings[0]
    "SIGNING_SECRET"              = var.signing_secret
    "BOT_USER_OAUTH_ACCESS_TOKEN" = var.bot_user_token
    "RECOGNIZE_EMOJI"             = ":oof:"
  }
}
