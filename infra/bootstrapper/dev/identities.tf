# Federated identity credentials for GitHub's immutable OIDC subject claims.
#
# GitHub now includes the numeric owner and repository IDs in the `sub` claim
# (`repo:pagopa@57742367/aiepdf-poc@1373623344:environment:...`) for repositories
# created after 2026-07-15, while the bootstrap module pinned here (`~> 4.0`)
# only creates credentials for the name-based form. Every CI/CD login therefore
# fails with AADSTS700213 "No matching federated identity record found".
#
# The module learns to create both forms in pagopa/dx#2219, which is not
# released yet: drop this file (imports included) and bump the module version
# as soon as it is. The credentials are adopted through `import` so the state
# tracks the existing ones instead of trying to recreate them.

data "github_organization" "owner" {
  name         = "pagopa"
  summary_only = true
}

data "github_repository" "this" {
  name = "aiepdf-poc"
}

locals {
  # Immutable subject prefix GitHub puts in front of the environment, built from
  # the numeric organisation and repository IDs.
  immutable_repository_slug = "pagopa@${data.github_organization.owner.id}/aiepdf-poc@${data.github_repository.this.repo_id}"

  # GitHub environments that authenticate to Azure, mapped to the managed
  # identity the bootstrap module creates for them.
  immutable_federated_credentials = {
    "app-dev-ci"        = module.azure-DEV-DEVEX_bootstrap.identities.app.ci.id
    "app-dev-cd"        = module.azure-DEV-DEVEX_bootstrap.identities.app.cd.id
    "infra-dev-ci"      = module.azure-DEV-DEVEX_bootstrap.identities.infra.ci.id
    "infra-dev-cd"      = module.azure-DEV-DEVEX_bootstrap.identities.infra.cd.id
    "automation-dev-cd" = module.azure-DEV-DEVEX_bootstrap.identities.infra.cd.id
    "opex-dev-ci"       = module.azure-DEV-DEVEX_bootstrap.identities.opex.ci.id
    "opex-dev-cd"       = module.azure-DEV-DEVEX_bootstrap.identities.opex.cd.id
  }
}

resource "azurerm_federated_identity_credential" "github_environment" {
  for_each = local.immutable_federated_credentials

  provider                  = azurerm.DEV-DEVEX
  name                      = "aiepdf-poc-environment-${each.key}-immutable"
  user_assigned_identity_id = each.value
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${local.immutable_repository_slug}:environment:${each.key}"
}

import {
  for_each = local.immutable_federated_credentials

  to = azurerm_federated_identity_credential.github_environment[each.key]
  id = "${each.value}/federatedIdentityCredentials/aiepdf-poc-environment-${each.key}-immutable"
}
