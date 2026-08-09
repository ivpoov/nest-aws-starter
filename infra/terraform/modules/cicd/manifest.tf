# ---------------------------------------------------------------------------
# The deploy manifest
#
# One SSM parameter holding one JSON object: every name, id and URL the deploy
# workflow needs. The workflow reads it once, at the top of the job, and derives
# everything else from it — which is what makes "no hand-copied URLs anywhere"
# true rather than aspirational. Change a bucket name in Terraform and the next
# deployment picks it up; there is no second copy to forget.
#
# Nothing in here is a secret. It is the same information `terraform output`
# prints, and the same information anyone with read access to the console can
# see. It is a String parameter, not a SecureString, so that this is obvious
# rather than implied by a KMS grant nobody reads.
# ---------------------------------------------------------------------------

locals {
  deploy_manifest_json = jsonencode(var.deploy_manifest)
}

resource "aws_ssm_parameter" "deploy_manifest" {
  name        = var.names.manifest_parameter
  description = "Deployment metadata for .github/workflows/deploy.yml. Written by Terraform, read by CI, never edited by hand."
  type        = "String"
  tier        = "Standard"
  value       = local.deploy_manifest_json

  lifecycle {
    precondition {
      # Standard-tier parameters cap at 4 KB. Crossing it is not a hard failure
      # in AWS — it is a switch to the Advanced tier, which is billed per
      # parameter per month and per API call — so it is caught here instead,
      # where the fix (drop a field, or set tier = "Advanced" deliberately) is
      # still a decision rather than a surprise on the invoice.
      condition     = length(local.deploy_manifest_json) <= 4096
      error_message = "The deploy manifest exceeds the 4 KB Standard-tier SSM parameter limit. Remove a field, or move the parameter to the Advanced tier knowing that it is then billed monthly."
    }
  }

  tags = {
    Name = var.names.manifest_parameter
    Tier = "cicd"
  }
}
