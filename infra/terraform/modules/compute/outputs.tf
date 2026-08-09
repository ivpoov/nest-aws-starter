# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

output "ecr_repository_urls" {
  description = "Repository URL to push to, keyed by the short name given in var.ecr_repositories. The deploy workflow's `docker push` target."
  value       = { for key, repository in aws_ecr_repository.this : key => repository.repository_url }
}

output "ecr_repository_arns" {
  description = "Repository ARNs, keyed by short name. The services module's execution-role policy is scoped to the same repositories by name."
  value       = { for key, repository in aws_ecr_repository.this : key => repository.arn }
}

output "api_image" {
  description = "Exact image reference the current task definition runs, repository and tag."
  value       = local.api_image
}

# ---------------------------------------------------------------------------
# Cluster and service
# ---------------------------------------------------------------------------

output "cluster_name" {
  description = "ECS cluster name — the --cluster argument of every ecs CLI call against this stack."
  value       = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.this.arn
}

output "service_name" {
  description = "ECS service name — the --service argument of `aws ecs update-service` and `aws ecs wait services-stable`."
  value       = aws_ecs_service.api.name
}

output "api_container_name" {
  description = "Name of the API container inside the task. Needed verbatim by `aws ecs run-task --overrides` and by anything that reads a specific container's exit code."
  value       = var.api_container_name
}

output "api_task_definition_family" {
  description = "Family of the API task definition. Deploying a new image means registering a new revision in this family, not editing the service's other settings."
  value       = aws_ecs_task_definition.api.family
}

output "api_task_definition_arn" {
  description = "ARN of the API task definition revision Terraform currently owns."
  value       = aws_ecs_task_definition.api.arn
}

output "capacity_provider" {
  description = "Capacity provider the service runs on: FARGATE_SPOT where the profile accepts reclamation, FARGATE otherwise."
  value       = local.capacity_provider
}

output "log_group_names" {
  description = "CloudWatch log groups this module created, keyed by role."
  value = {
    api        = aws_cloudwatch_log_group.api.name
    migrations = aws_cloudwatch_log_group.migrations.name
  }
}

# ---------------------------------------------------------------------------
# Load balancer — consumed by the edge stack
# ---------------------------------------------------------------------------

output "alb_dns_name" {
  description = "DNS name of the load balancer. This is the value edge.tf's local.edge_alb_dns_name needs in order to put CloudFront in front of the API."
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  description = "Route 53 hosted zone id of the load balancer, for alias records pointed at it from outside this module."
  value       = aws_lb.api.zone_id
}

output "alb_arn" {
  description = "ARN of the load balancer."
  value       = aws_lb.api.arn
}

output "alb_arn_suffix" {
  description = "Load balancer ARN suffix — the form CloudWatch's AWS/ApplicationELB dimensions take, for alarms in the observability stack."
  value       = aws_lb.api.arn_suffix
}

output "target_group_arn" {
  description = "ARN of the API target group."
  value       = aws_lb_target_group.api.arn
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix, for the TargetGroup dimension on UnHealthyHostCount and TargetResponseTime alarms."
  value       = aws_lb_target_group.api.arn_suffix
}

output "api_url" {
  description = "Origin the API is reachable on at the load balancer: https://<hostname> with a custom domain, http://<alb-dns-name> without one. The http form is a test posture — see the warning on the listener in alb.tf."
  value       = local.custom_domain_enabled ? "https://${var.api_hostname}" : "http://${aws_lb.api.dns_name}"
}

output "api_certificate_arn" {
  description = "Regional ACM certificate terminating TLS at the load balancer, or null when no custom domain is configured. Not the same certificate as the edge module's — that one is in us-east-1 for CloudFront."
  value       = one(aws_acm_certificate.api[*].arn)
}

output "https_enabled" {
  description = "True when the load balancer terminates HTTPS. False means port 80 forwards in the clear and the deployment is test-only."
  value       = local.custom_domain_enabled
}

# ---------------------------------------------------------------------------
# Autoscaling
# ---------------------------------------------------------------------------

output "autoscaling" {
  description = "Effective scaling posture of the service. max_capacity above one is also what makes the scheduler's Redis lock and the Socket.IO Redis adapter reachable, and what the data module reads to require a shared cache."
  value = {
    enabled            = var.autoscaling_enabled
    min_capacity       = var.autoscaling_enabled ? var.min_capacity : var.desired_count
    max_capacity       = var.autoscaling_enabled ? var.max_capacity : var.desired_count
    target_cpu_percent = var.autoscaling_enabled ? var.autoscaling_target_cpu_percent : null
  }
}

# ---------------------------------------------------------------------------
# Migrations — the deploy contract
# ---------------------------------------------------------------------------

output "migration_task_definition_family" {
  description = "Family of the one-off migration task definition. `aws ecs run-task --task-definition <family>` always resolves the latest revision."
  value       = aws_ecs_task_definition.migrations.family
}

output "migration_task_definition_arn" {
  description = "ARN of the migration task definition revision Terraform currently owns."
  value       = aws_ecs_task_definition.migrations.arn
}

output "migration_container_name" {
  description = "Name of the migration container. The deployment gate reads this container's exitCode out of `aws ecs describe-tasks`."
  value       = local.migrations_container_name
}

output "migration_image" {
  description = "Image reference the migration task runs. Same repository as the API, different tag — the runtime image has no Prisma CLI, so the deploy workflow must build and push this tag as well."
  value       = local.migrations_image
}

output "migration_network_configuration" {
  description = "Value for `aws ecs run-task --network-configuration`, already JSON-encoded. Identical placement to the service, so migrations reach the database through the same security group."
  value = jsonencode({
    awsvpcConfiguration = {
      subnets        = var.workload_subnet_ids
      securityGroups = [var.api_security_group_id]
      assignPublicIp = var.workload_subnets_are_public ? "ENABLED" : "DISABLED"
    }
  })
}

output "migration_task_contract" {
  description = <<-EOT
    The contract between this module and the deploy workflow, in full. Terraform
    owns the task definition; it does not and cannot run it, because a deployment
    is a sequence and Terraform is a convergence.
  EOT

  value = <<-EOT
    MIGRATIONS RUN BEFORE THE SERVICE IS UPDATED. NOT IN THE APP ENTRYPOINT.

    Order is the whole point. Migrations must be applied while the old task
    definition is still the one serving, so the deployment step order is:

      1. build and push BOTH images to ${aws_ecr_repository.this["api"].repository_url}
           :<sha>          runtime image  (Dockerfile default target)
           :${var.migrations_image_tag}   migration image (Dockerfile --target build)
         The runtime image has no Prisma CLI on purpose; it cannot run step 2.

      2. run the migration task and BLOCK on it:

           TASK_ARN=$(aws ecs run-task \
             --cluster ${aws_ecs_cluster.this.name} \
             --task-definition ${aws_ecs_task_definition.migrations.family} \
             --capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
             --network-configuration '<migration_network_configuration>' \
             --query 'tasks[0].taskArn' --output text)

           aws ecs wait tasks-stopped --cluster ${aws_ecs_cluster.this.name} --tasks "$TASK_ARN"

         FARGATE, never FARGATE_SPOT: a reclaimed Spot task in the middle of a
         DDL statement is the one interruption with no safe retry.

      3. GATE ON THE EXIT CODE. A stopped task is not a successful one:

           EXIT=$(aws ecs describe-tasks --cluster ${aws_ecs_cluster.this.name} --tasks "$TASK_ARN" \
             --query 'tasks[0].containers[?name==`${local.migrations_container_name}`].exitCode | [0]' \
             --output text)
           [ "$EXIT" = "0" ] || { aws logs tail ${aws_cloudwatch_log_group.migrations.name} --since 10m; exit 1; }

         Anything other than 0 fails the deployment here, with the old task
         definition still serving and nothing changed.

      4. only then update the service:

           aws ecs update-service --cluster ${aws_ecs_cluster.this.name} \
             --service ${aws_ecs_service.api.name} \
             --task-definition <new-revision> --force-new-deployment
           aws ecs wait services-stable --cluster ${aws_ecs_cluster.this.name} --services ${aws_ecs_service.api.name}

         The service's deployment circuit breaker rolls back on its own if the
         new task definition cannot start; `wait services-stable` is what makes
         the workflow notice.

    COROLLARY FOR MIGRATION AUTHORS: between step 2 and the end of step 4 the
    old code is running against the new schema. Migrations must be backward
    compatible for the length of one deploy — add a column before writing to it,
    stop reading a column before dropping it.
  EOT
}
