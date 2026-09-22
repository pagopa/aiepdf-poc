# Storage account for the confidential adhesion agreements.
#
# `use_case = "development"` provides LRS replication, public network access
# disabled, and a blob private endpoint without production alerting.
module "storage_account" {
  source  = "pagopa-dx/azure-storage-account/azurerm"
  version = "~> 4.0"

  environment         = local.environment
  resource_group_name = data.azurerm_resource_group.workload.name
  use_case            = "development"

  subnet_pep_id                        = module.azure_core_values.common_pep_snet.id
  private_dns_zone_resource_group_name = module.azure_core_values.network_resource_group_name

  containers = [
    {
      name        = local.agreement_container_name
      access_type = "private"
    }
  ]

  tags = local.tags
}
