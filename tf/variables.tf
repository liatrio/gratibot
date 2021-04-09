variable "acr_subscription_id" {
  description = "Azure subscription to use for Gratibot resources"
  type        = string
}

variable "resource_group_name" {
  description = "Azure resource group for Gratibot"
  default     = "gratibot-azure-data"
  type        = string
}

variable "location" {
  description = "Primary deployment region for Azure resources"
  default     = "Central US"
  type        = string
}

variable "environment" {
  description = "Environment for Gratibot deployment(nonprod, prod)"
  type        = string
}

variable "gratibot_image" {
  description = "Docker image to be used for Gratibot service"
  type        = string
}

variable "signing_secret" {
  description = "Signing secret for Slack app integration"
  type        = string
  sensitive   = true
}

variable "bot_user_token" {
  description = "Bot OAuth token for Slack app integration"
  type        = string
  sensitive   = true
}
