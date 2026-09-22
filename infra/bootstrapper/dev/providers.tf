terraform {
  required_version = ">= 1.15.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }

    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }

    github = {
      source  = "integrations/github"
      version = "~> 6.12"
    }
  }
}

provider "azurerm" {
  features {}
  storage_use_azuread = true
  subscription_id     = "35e6e3b2-4388-470e-a1b9-ad3bc34326d1"
  alias               = "DEV-DEVEX"
}

provider "github" {
  owner = "pagopa"
}