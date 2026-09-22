# PostgreSQL Flexible Server backing Practices and Documents.
#
# The module generates the admin password with write-only attributes and stores
# it in the core Key Vault, so the value never appears in Terraform state.
ephemeral "random_password" "postgres_admin" {
  length  = 32
  special = true
}

module "postgres" {
  source  = "pagopa-dx/azure-postgres-server/azurerm"
  version = "~> 5.0"

  environment         = local.environment
  resource_group_name = data.azurerm_resource_group.workload.name
  # "default" is the only use case supported by the module.
  use_case = "default"

  admin_username         = local.postgres.admin_username
  admin_password         = ephemeral.random_password.postgres_admin.result
  admin_password_version = local.postgres.admin_password_version

  key_vault_id = module.azure_core_values.common_key_vault.id

  private_dns_zone_resource_group_name = module.azure_core_values.network_resource_group_name
  subnet_pep_id                        = module.azure_core_values.common_pep_snet.id

  # Pilot sizing: single server, no read replica, no deletion lock.
  create_replica = false
  enable_lock    = false
  alerts_enabled = false

  tags = local.tags
}
