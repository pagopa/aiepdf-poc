output "container_app_name" {
  description = "The name of the adhesion-api Container App."
  value       = module.container_app.name
}

output "resource_group_name" {
  description = "The resource group that hosts the workload resources."
  value       = data.azurerm_resource_group.workload.name
}

output "container_app_fqdn" {
  description = "The fully qualified domain name of the adhesion-api Container App."
  value       = module.container_app.url
}

output "app_configuration_endpoint" {
  description = "The endpoint of the Azure App Configuration instance."
  value       = module.app_configuration.endpoint
}

output "storage_account_name" {
  description = "The name of the storage account holding the agreement blobs."
  value       = module.storage_account.name
}

output "postgres_host" {
  description = "The fully qualified host name of the PostgreSQL Flexible Server."
  value       = "${module.postgres.postgres.name}.postgres.database.azure.com"
}

output "static_web_app_name" {
  description = "The name of the Static Web App hosting the Next.js UI."
  value       = azurerm_static_web_app.this.name
}

output "static_web_app_default_hostname" {
  description = "The default host name of the Static Web App."
  value       = azurerm_static_web_app.this.default_host_name
}
