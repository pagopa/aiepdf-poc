module "github_repository" {
  source  = "pagopa-dx/github-environment-bootstrap/github"
  version = "~> 1.0"

  repository = {
    name                   = "aeipdf-poc"
    description            = "AIEPDF PoC"
    topics                 = []
    reviewers_teams        = []
  }
}
