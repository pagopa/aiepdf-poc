terraform {
  required_version = ">= 1.15.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }

    # DX provider (functions and resources such as dx_available_subnet_cidr and
    # resource_name). The DX modules declare it locally as `dx`, while the
    # repository root declares it as `azuredx` (same source, mirrored from
    # dx/infra/resources/prod).
    azuredx = {
      source  = "pagopa-dx/azure"
      version = "~> 0.12"
    }

    # Required by the pagopa-dx/azure-container-app module.
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.9"
    }

    time = {
      source  = "hashicorp/time"
      version = "~> 0.14"
    }

    # Used to generate the PostgreSQL admin password via an ephemeral resource.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "azurerm" {
  features {}
  storage_use_azuread = true
  subscription_id     = "35e6e3b2-4388-470e-a1b9-ad3bc34326d1"
}

provider "azuredx" {}
provider "azapi" {}
provider "time" {}
provider "random" {}
