# ---------------------------------------------------------------------------
# ECR
#
# One repository per container image this stack runs. The frontends are static
# Vite builds served from S3 through CloudFront (see modules/edge), so there is
# no web image and no web repository — the caller decides that by what it puts
# in var.ecr_repositories.
#
# Two things every ECR repository needs and most do not get:
#
#   scan on push      Basic scanning is free. It matches pushed images against
#                     the CVE feed for their base OS packages, which is the one
#                     class of vulnerability a lockfile audit cannot see: a
#                     patched Alpine that has since gone stale.
#   lifecycle policy  Without one a repository grows without limit and bills
#                     $0.10/GB-month forever. Both halves below matter — see the
#                     policy's own comments.
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  for_each = var.ecr_repositories

  name = each.value

  # MUTABLE, with eyes open. IMMUTABLE is the stronger supply-chain posture and
  # the right default for a registry whose tags are only ever commit SHAs — but
  # it also makes `docker push :latest` fail on the second build, which breaks
  # the first thing anyone does with a starter. Deployments should still pin a
  # SHA tag (see var.api_image_tag); flip this to IMMUTABLE once they do.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # AES256 with the ECR-owned key: free, and it needs no kms:Decrypt statement on
  # the execution role. A customer-managed KMS key would be stronger and would
  # require widening that role, which the services module owns.
  encryption_configuration {
    encryption_type = "AES256"
  }

  # A repository full of images blocks `terraform destroy` otherwise, which is
  # exactly the "disposable stack you cannot dispose of" the demo profile exists
  # to avoid.
  force_delete = var.force_delete_repositories

  tags = {
    Name = each.value
    Tier = "compute"
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  # Rule order is load-bearing: ECR evaluates rules by ascending priority and an
  # image is only ever matched by the first rule that applies. The untagged rule
  # therefore has to come first — a leading `tagStatus: any` rule would swallow
  # every image and the untagged rule would never run.
  policy = jsonencode({
    rules = [
      {
        # The slow leak. Re-pushing a tag does not delete the image it displaced;
        # it just unpins it, and the layers stay billable indefinitely. Nothing
        # in AWS cleans them up. The day of grace is so an image that has been
        # pushed but not yet tagged by a running build is not deleted mid-flight.
        rulePriority = 1
        description  = "Expire untagged images after ${var.untagged_image_expiry_days} day(s) — a re-pushed tag orphans its predecessor, and nothing else ever reclaims it."
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_image_expiry_days
        }
        action = { type = "expire" }
      },
      {
        # Keep enough history to roll back to, and no more. "Last N" counts by
        # push time, so the currently deployed image is only safe while fewer
        # than N images have been pushed since — which, at N = 10, means a
        # rollback target survives a normal week of deploys.
        rulePriority = 2
        description  = "Keep only the ${var.image_retention_count} most recently pushed images."
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.image_retention_count
        }
        action = { type = "expire" }
      },
    ]
  })
}
