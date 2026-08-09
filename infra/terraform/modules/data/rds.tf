# ---------------------------------------------------------------------------
# PostgreSQL on RDS
#
# One instance, private, encrypted, with automated backups. Not Aurora: see the
# "Why not Aurora Serverless v2" section of README.md, which states the floor
# cost of the alternative rather than quietly picking this one.
# ---------------------------------------------------------------------------

locals {
  # "18" -> "postgres18", "18.4" -> "postgres18". The parameter group family
  # tracks the engine's major version and nothing else.
  database_parameter_group_family = "postgres${split(".", var.database_engine_version)[0]}"
}

# The master password never leaves Terraform: it is generated here, spliced into
# DATABASE_URL, and written to an encrypted SSM parameter. It exists in state,
# which is why the bootstrap stack's state bucket is versioned, encrypted and
# blocked from public access — and why no output in this module exposes it.
resource "random_password" "database" {
  length = 40

  # RDS rejects '/', '@', '"' and spaces outright, and every remaining symbol
  # would have to be percent-encoded on its way into a URL. Forty characters of
  # mixed-case alphanumerics carry ~238 bits, which is far more than the
  # connection is worth; the symbols would buy nothing but encoding bugs.
  special = false

  # Enough of each class that the string is unmistakably generated, and that
  # any future password policy on the instance is satisfied without a reroll.
  min_upper   = 4
  min_lower   = 4
  min_numeric = 4
}

resource "aws_db_subnet_group" "this" {
  name        = var.names.database_subnet_group
  description = "Subnets the database instance may be placed in."
  subnet_ids  = var.subnet_ids

  tags = {
    Name = var.names.database_subnet_group
    Tier = "data"
  }
}

# A parameter group of our own, rather than the default one, exists for a single
# setting: rds.force_ssl. The default group leaves it off, and off means the
# server happily accepts an unencrypted connection — so a DATABASE_URL that
# quietly loses its sslmode still works, and nobody finds out.
resource "aws_db_parameter_group" "this" {
  name        = var.names.database_parameter_group
  family      = local.database_parameter_group_family
  description = "Require TLS and log slow statements."

  parameter {
    name  = "rds.force_ssl"
    value = "1"

    # Dynamic on PostgreSQL 15 and later, which is what this stack targets. On
    # 14 and earlier it is static: change this to "pending-reboot" if you pin
    # database_engine_version to an older major.
    apply_method = "immediate"
  }

  # One second. High enough that a healthy request never writes a line, low
  # enough that the query which will eventually take the site down shows up in
  # the log before it does.
  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"
    apply_method = "immediate"
  }

  tags = {
    Name = var.names.database_parameter_group
    Tier = "data"
  }
}

resource "aws_db_instance" "this" {
  identifier     = var.names.database_identifier
  engine         = "postgres"
  engine_version = var.database_engine_version
  instance_class = var.database_instance_class

  allocated_storage     = var.database_allocated_storage_gb
  max_allocated_storage = var.database_max_allocated_storage_gb
  storage_type          = "gp3"

  # Encryption at rest with the AWS-managed RDS key. Free, and it cannot be
  # turned on later: an unencrypted instance has to be snapshotted, copied with
  # encryption, and restored. There is no reason to start without it.
  storage_encrypted = true

  db_name  = var.database_name
  username = var.database_username
  password = random_password.database.result
  port     = var.database_port

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [var.database_security_group_id]

  # Not negotiable. The security group already admits only the API task, but a
  # publicly accessible instance also gets a public DNS name, and "restricted by
  # security group" is one careless rule away from "on the internet".
  publicly_accessible = false
  multi_az            = var.database_multi_az

  backup_retention_period = var.database_backup_retention_days
  backup_window           = var.database_backup_window
  maintenance_window      = var.database_maintenance_window

  # Without this a restored snapshot arrives untagged, which means it is missing
  # the Project/Environment tags every cost report and cleanup script keys off.
  copy_tags_to_snapshot = true

  auto_minor_version_upgrade = true
  apply_immediately          = var.database_apply_immediately

  performance_insights_enabled = var.database_performance_insights_enabled
  # Seven days is the free tier. Anything longer is billed per vCPU per month.
  performance_insights_retention_period = var.database_performance_insights_enabled ? 7 : null

  # Enhanced Monitoring (OS-level metrics at sub-minute resolution) is billed
  # through CloudWatch Logs and needs an IAM role of its own. The standard RDS
  # metrics plus Performance Insights answer the questions this stack asks.
  monitoring_interval = 0

  # Deliberately not exporting the postgresql log to CloudWatch: ingestion is
  # billed per GB and log_min_duration_statement above is doing the useful part.
  # Add enabled_cloudwatch_logs_exports = ["postgresql"] when you need the log
  # searchable, and expect a line on the bill.

  deletion_protection = var.database_deletion_protection
  skip_final_snapshot = var.database_skip_final_snapshot

  # A fixed name, so it is predictable. AWS keeps final snapshots after the
  # instance is gone, so recreating and destroying the same stack twice collides
  # — delete the old snapshot, or rename it, before the second destroy.
  final_snapshot_identifier = var.database_skip_final_snapshot ? null : "${var.names.database_identifier}-final"

  tags = {
    Name = var.names.database_identifier
    Tier = "data"
  }
}
