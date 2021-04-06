//data "azurerm_user_assigned_identity" "assigned_identity_acr_pull" {
// name                = "User_ACR_pull"
// resource_group_name = var.resource_group_name
//}

resource "azurerm_app_service_plan" "my_service_plan" {
 name                = "gratibot-service-plan"
 location            = "Central US"
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
 location                = "Central US"
 resource_group_name     = var.resource_group_name
 app_service_plan_id     = azurerm_app_service_plan.my_service_plan.id
 https_only              = true
 client_affinity_enabled = true
 site_config {
   always_on = "true"
   linux_fx_version  = "DOCKER|${var.gratibot_image}"
 }

 //identity {
 //  type         = "SystemAssigned, UserAssigned"
 //  identity_ids = [data.azurerm_user_assigned_identity.assigned_identity_acr_pull.id]
 //}
}
