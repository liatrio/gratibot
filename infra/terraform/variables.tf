variable "resource_group_name" {
  description = "Azure resource group for Gratibot"
  default     = "gratibot-azure-data"
  type        = string
}

variable "key_vault_name" {
  description = "Key vault containing required Gratibot secrets"
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


variable "instance_tier" {
  description = "Service plan to use for App Serivce"
  default     = "Basic"
  type        = string
}

variable "instance_size" {
  description = "Instance size to use for App Serivce"
  default     = "B1"
  type        = string
}

variable "instance_capacity" {
  description = "Workers associated with App Service Plan"
  default     = "1"
  type        = string
}

variable "gratibot_image" {
  description = "Docker image to be used for Gratibot service"
  type        = string
}

variable "gratibot_image_registry" {
  description = "Image registry for Gratibot"
  type        = string
  default     = "https://ghcr.io"
}

variable "gratibot_recognize_emoji" {
  description = "Recognition emoji to use for recognitions"
  type        = string
  default     = ":fistbump:"
}

variable "gratibot_reaction_emoji" {
  description = "Reaction emoji to use for recognitions"
  type        = string
  default     = ":shut_up_and_take_my_fistbump:"
}

variable "gratibot_log_level" {
  description = "Logging level to use for Gratibot service"
  type        = string
  default     = "info"
}

variable "gratibot_limit" {
  description = "The limit of fistbumps one person can give in a single day."
  type        = string
  default     = "5"
}
