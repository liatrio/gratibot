terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.50.0"
    }
  }
}

provider "azurerm" {
  subscription_id = var.acr_subscription_id
  features {}
  skip_provider_registration = "true"
}
