data "azurerm_key_vault" "gratibot" {
  name                = var.key_vault_name
  resource_group_name = var.resource_group_name
}

resource "azurerm_role_assignment" "gratibot" {
  scope                = data.azurerm_key_vault.gratibot.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.gratibot_app_service.identity.0.principal_id
}

resource "azurerm_key_vault_secret" "mongo_connection_string" {
  name         = "mongo-connection-string"
  value        = azurerm_cosmosdb_account.db_account.connection_strings[0]
  key_vault_id = data.azurerm_key_vault.gratibot.id
}

data "azurerm_key_vault_secret" "app_token" {
  name         = "app-token"
  key_vault_id = data.azurerm_key_vault.gratibot.id
}

data "azurerm_key_vault_secret" "bot_user_token" {
  name         = "bot-user-token"
  key_vault_id = data.azurerm_key_vault.gratibot.id
}
