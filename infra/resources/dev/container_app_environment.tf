# Container App Environment hosting the adhesion-api workload.
#
# The DX module provisions the Container App subnet itself, using the
# pagopa-dx/azure provider's `dx_available_subnet_cidr` resource. The subnet size
# is derived from `use_case` (/27 for "development", /23 for "default"); the
# module does not expose a subnet prefix length input.
module "container_app_environment" {
  source  = "pagopa-dx/azure-container-app-environment/azurerm"
  version = "~> 4.0"

  environment         = local.environment
  resource_group_name = module.azure_core_values.common_resource_group_name
  use_case            = "development"

  log_analytics_workspace_id = module.azure_core_values.common_log_analytics_workspace.id

  networking = {
    virtual_network_id                   = module.azure_core_values.common_vnet.id
    private_dns_zone_resource_group_name = module.azure_core_values.network_resource_group_name
    # Public ingress is required because the Static Web App calls the API
    # directly from the browser.
    public_network_access_enabled = true
  }

  tags = local.tags
}
