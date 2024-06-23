resource "azurerm_log_analytics_workspace" "gratibot" {
  name                = "gratibot-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.5
}

resource "azurerm_monitor_diagnostic_setting" "gratibot-logs" {
  name                       = "gratibot-logs"
  target_resource_id         = azurerm_linux_web_app.gratibot_app_service.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.gratibot.id

  enabled_log {
    category = "AppServiceConsoleLogs"
  }
  metric {
    category = "AllMetrics"
    enabled  = false
  }
}
