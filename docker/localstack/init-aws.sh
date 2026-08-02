#!/usr/bin/env bash
# Runs inside the LocalStack container once services are ready.
set -euo pipefail

awslocal sqs create-queue --queue-name starter-queue
awslocal sns create-topic --name starter-topic
awslocal sesv2 create-email-identity --email-identity no-reply@example.com

echo "localstack init done: queue, topic and ses identity created"
