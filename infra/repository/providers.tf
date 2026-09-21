terraform {
  required_version = ">= 1.15.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.12"
    }
  }
}

# GitHub provider configuration
provider "github" {
  owner = "pagopa"
}
