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

variable "gratibot_self_recognize_emoji" {
  description = "Self-recognition emoji to use for self recognitions"
  type        = string
  default     = ":self-fistbump:"
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

variable "stadium_enabled" {
  description = "Whether Stadium redemption is exposed to users"
  type        = bool
  default     = false
}

variable "stadium_api_base_url" {
  description = "Stadium API v2 base URL"
  type        = string
  default     = "https://api.preprod.bystadium.com/api/v2"
}

variable "stadium_store_number" {
  description = "Global organization Stadium store number"
  type        = string
  default     = ""
}

variable "stadium_store_url" {
  description = "Stadium SSO store URL shown after fulfillment"
  type        = string
  default     = ""
}

variable "stadium_payment_method" {
  description = "Comma-separated Stadium send_points methods: use_wallet_money and/or use_global_point"
  type        = string
  default     = ""
}

variable "stadium_billing_country" {
  description = "Stadium billing country"
  type        = string
  default     = ""
}

variable "stadium_billing_zipcode" {
  description = "Stadium billing postal code"
  type        = string
  default     = ""
}

variable "stadium_fistbumps_per_unit" {
  description = "Fistbumps in one conversion unit"
  type        = number
  default     = 1
}

variable "stadium_points_per_unit" {
  description = "Stadium points issued per conversion unit"
  type        = number
  default     = 1
}

variable "stadium_min_fistbumps" {
  description = "Minimum fistbumps per Stadium redemption"
  type        = number
  default     = 1
}

variable "stadium_max_fistbumps" {
  description = "Optional maximum fistbumps per Stadium redemption"
  type        = string
  default     = ""

  validation {
    condition = var.stadium_max_fistbumps == "" || (
      can(tonumber(var.stadium_max_fistbumps)) &&
      tonumber(var.stadium_max_fistbumps) >= 1 &&
      floor(tonumber(var.stadium_max_fistbumps)) == tonumber(var.stadium_max_fistbumps)
    )
    error_message = "stadium_max_fistbumps must be empty or a positive whole number."
  }
}
