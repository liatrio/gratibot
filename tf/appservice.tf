resource "azurerm_app_service_plan" "my_service_plan" {
 name                = "gratibot-service-plan"
 location            = var.location
 resource_group_name = var.resource_group_name
 kind                = "Linux"
 reserved            = true

 sku {
   tier     = "PremiumV2"
   size     = "P2v2"
   capacity = "3"
 }
}

resource "azurerm_app_service" "gratibot-app-service" {
 name                    = "gratibot-app-service"
 location                = var.location
 resource_group_name     = var.resource_group_name
 app_service_plan_id     = azurerm_app_service_plan.my_service_plan.id
 https_only              = true
 client_affinity_enabled = true
 site_config {
   always_on = "true"
   linux_fx_version  = "DOCKER|${var.gratibot_image}"
 }

 app_settings = {
    "MONGO_URL" = azurerm_cosmosdb_account.db_account.connection_strings[0]
    "SIGNING_SECRET" = var.signing_secret
    "BOT_USER_OAUTH_TOKEN" = var.bot_user_token
  }

}
