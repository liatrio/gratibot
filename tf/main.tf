terraform {
  backend "azurerm" {
    resource_group_name  = "gratibot-azure-data"
    storage_account_name = "gratibotazuredatatfnp"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  subscription_id = var.acr_subscription_id
  features {}
  skip_provider_registration = "true"
}
