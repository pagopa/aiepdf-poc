# Adopt the environment-wide role assignments the DX core already created.
#
# `additional_resource_group_ids` makes the bootstrap module grant the
# environment-wide AD groups (admins, developers, externals) and this
# repository's managed identities their roles on every resource group it is
# given, including the shared common one. The AD group assignments on the common
# resource group already exist: the DX core created them when it provisioned the
# shared environment, so the module would fail with `RoleAssignmentExists`
# (409). Adopt them through `import` instead of recreating them.
#
# The managed identity assignments do not conflict: they are specific to this
# repository's identities, so the module still creates them.
#
# The `to` index must be a literal resource group id, not a local: Terraform
# only accepts constant keys in an import address.

import {
  to = module.azure-DEV-DEVEX_bootstrap.azurerm_role_assignment.admins_group_rgs["/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01"]
  id = "/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01/providers/Microsoft.Authorization/roleAssignments/62a4883f-439c-91f5-82ae-6315aaba36a4"
}

import {
  to = module.azure-DEV-DEVEX_bootstrap.azurerm_role_assignment.admins_group_rgs_kv_data["/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01"]
  id = "/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01/providers/Microsoft.Authorization/roleAssignments/bafea926-69ce-27d5-c925-1410b5aae0a0"
}

import {
  to = module.azure-DEV-DEVEX_bootstrap.azurerm_role_assignment.admins_group_rgs_kv_admin["/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01"]
  id = "/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01/providers/Microsoft.Authorization/roleAssignments/8959dca5-4e7c-922c-7f62-e4103ad55afe"
}

import {
  to = module.azure-DEV-DEVEX_bootstrap.azurerm_role_assignment.devs_group_rgs["/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01"]
  id = "/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01/providers/Microsoft.Authorization/roleAssignments/264df9a5-6c44-c067-b88e-c8e52214a746"
}

import {
  to = module.azure-DEV-DEVEX_bootstrap.azurerm_role_assignment.devs_group_tf_rgs_kv_secr["/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01"]
  id = "/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01/providers/Microsoft.Authorization/roleAssignments/9e9d5c6e-2ce7-b3f2-4f1d-f578e124efea"
}

import {
  to = module.azure-DEV-DEVEX_bootstrap.azurerm_role_assignment.externals_group_rgs["/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01"]
  id = "/subscriptions/35e6e3b2-4388-470e-a1b9-ad3bc34326d1/resourceGroups/dx-d-itn-common-rg-01/providers/Microsoft.Authorization/roleAssignments/2cd6753b-dd93-5db7-930e-9b817cc8359f"
}
