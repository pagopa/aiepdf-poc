# Azure App Configuration for the adhesion-api workload.
#
# The instance uses the core Key Vault for Key Vault references. The
# `app_principal_ids` list is intentionally empty: the least-privilege access of
# the container app identity to both App Configuration and the Key Vault is
# granted by the dedicated role-assignments module (see role_assignments.tf), so
# no duplicate assignments are created here.
module "app_configuration" {
  source  = "pagopa-dx/azure-app-configuration/azurerm"
  version = "~> 0.1"

  environment         = local.environment
  resource_group_name = module.azure_core_values.common_resource_group_name
  subscription_id     = data.azurerm_subscription.current.subscription_id
  use_case            = "default"

  subnet_pep_id = module.azure_core_values.common_pep_snet.id
  virtual_network = {
    name                = module.azure_core_values.common_vnet.name
    resource_group_name = module.azure_core_values.network_resource_group_name
  }

  private_dns_zone_resource_group_name = module.azure_core_values.network_resource_group_name

  key_vaults = [
    {
      name                = module.azure_core_values.common_key_vault.name
      resource_group_name = module.azure_core_values.common_key_vault.resource_group_name
      has_rbac_support    = true
      app_principal_ids   = []
    }
  ]

  tags = local.tags
}
