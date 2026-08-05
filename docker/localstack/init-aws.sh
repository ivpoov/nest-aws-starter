#!/usr/bin/env bash
# Runs inside the LocalStack container once services are ready.
set -euo pipefail

awslocal sqs create-queue --queue-name starter-queue
awslocal sqs create-queue --queue-name starter-payment-webhook-queue
awslocal sns create-topic --name starter-topic
awslocal ses verify-email-identity --email-address no-reply@example.com

echo "localstack init done: queues, topic and ses identity created"
