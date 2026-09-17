module "github_repository" {
  source  = "pagopa-dx/github-environment-bootstrap/github"
  version = "~> 1.0"

  repository = {
    name                   = "aiepdf-poc"
    description            = "AIEPDF PoC"
    topics                 = []
    reviewers_teams        = []
    environments           = []
  }
}
