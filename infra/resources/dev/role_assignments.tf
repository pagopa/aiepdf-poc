# Least-privilege role assignments for the container app managed identity.
module "container_app_role_assignments" {
  source  = "pagopa-dx/azure-role-assignments/azurerm"
  version = "~> 4.0"

  principal_id    = module.container_app.principal_id
  subscription_id = data.azurerm_subscription.current.subscription_id

  storage_blob = [
    {
      storage_account_name = module.storage_account.name
      resource_group_name  = module.storage_account.resource_group_name
      container_name       = local.agreement_container_name
      role                 = "writer"
      description          = "Allow the adhesion-api container app to read and write agreement blobs"
    }
  ]

  app_config = [
    {
      name                = module.app_configuration.name
      resource_group_name = module.app_configuration.resource_group_name
      role                = "reader"
      description         = "Allow the adhesion-api container app to read App Configuration data"
    }
  ]

  key_vault = [
    {
      name                = module.azure_core_values.common_key_vault.name
      resource_group_name = module.azure_core_values.common_key_vault.resource_group_name
      has_rbac_support    = true
      description         = "Allow the adhesion-api container app to read secrets from the core Key Vault"
      roles = {
        secrets = "reader"
      }
    }
  ]
}
