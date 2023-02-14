locals {
  common      = yamldecode(file(find_in_parent_folders("common.yaml")))
  environment = yamldecode(file(find_in_parent_folders("environment.yaml")))
}

inputs = merge(
  local.common,
  local.environment
)


generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents = <<EOF
terraform {
  backend "azurerm" {
    resource_group_name  = "gratibot-azure-data"
    storage_account_name = "${local.environment.state_storage_account}"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}
EOF
}
