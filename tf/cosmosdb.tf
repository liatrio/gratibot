resource "azurerm_cosmosdb_account" "db_account" {
  name                = "gratibot-cosmos-${var.environment}-acc"
  location            = var.location
  resource_group_name = var.resource_group_name
  offer_type          = "Standard"
  kind                = "MongoDB"

  enable_automatic_failover = true

  capabilities { # forces replacement
    name = "EnableMongo"
    name = "DisableRateLimitingResponses"
  }

  consistency_policy {
    consistency_level       = "BoundedStaleness"
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_mongo_database" "mongo_db" {
  name                = "gratibot-cosmos-${var.environment}-mongo-db"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.db_account.name
  throughput          = 400
}
