#!/usr/bin/env bash
# Runs inside the LocalStack container once services are ready.
set -euo pipefail

awslocal sqs create-queue --queue-name starter-queue
awslocal sqs create-queue --queue-name starter-payment-webhook-queue
awslocal sns create-topic --name starter-topic
awslocal ses verify-email-identity --email-address no-reply@example.com
# The `full` profile's sender. It cannot reuse the address above: that one is
# the MAIL_FROM_ADDRESS shipped in .env.example, and the production boot guard
# refuses to start while a development default is still in place.
awslocal ses verify-email-identity --email-address no-reply@api.example.com

echo "localstack init done: queues, topic and ses identities created"
