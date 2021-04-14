terraform {
  backend "azurerm" {}
}

provider "azurerm" {
  subscription_id = var.acr_subscription_id
  features {}
  skip_provider_registration = "true"
}
