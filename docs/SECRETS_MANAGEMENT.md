# Secrets Management Guide

## Overview

This project uses a multi-layered approach to secrets management to ensure security across all environments.

## Strategy

### Local Development
- Use `.env` files (NOT committed to Git)
- Copy `.env.example` to `.env` and populate with development values
- Use non-production API keys

### CI/CD (GitHub Actions)
- Store secrets in GitHub Secrets (Settings → Secrets and variables → Actions)
- Use environment-specific secrets
- Required secrets:
  - `VITE_ANTHROPIC_API_KEY` - Anthropic API key
  - `VITE_FIREBASE_*` - Firebase configuration
  - `SNYK_TOKEN` - Snyk security scanning
  - `FOSSA_API_KEY` - License compliance scanning
  - `PROD_DEPLOY_KEY` - SSH key for production deployments

### Production Deployment

#### Option 1: Docker Secrets (Docker Swarm)
```bash
# Create secrets
echo "api-key-value" | docker secret create anthropic_api_key -

# Reference in docker-compose:
services:
  api:
    secrets:
      - anthropic_api_key
    environment:
      VITE_ANTHROPIC_API_KEY_FILE: /run/secrets/anthropic_api_key
```

#### Option 2: AWS Secrets Manager
```javascript
// src/utils/getSecrets.js
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export async function getSecret(secretName) {
  const client = new SecretsManagerClient({ region: "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return JSON.parse(response.SecretString);
}
```

#### Option 3: HashiCorp Vault
```bash
# Install Vault Agent
vault agent -config=vault-agent.hcl

# vault-agent.hcl
auto_auth {
  method "kubernetes" {
    mount_path = "auth/kubernetes"
  }
}

template {
  source      = "/vault/secrets/env.tpl"
  destination = "/app/.env"
}
```

#### Option 4: Kubernetes Secrets + External Secrets Operator
```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: prompt-builder-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: prompt-builder-secrets
  data:
    - secretKey: anthropic-api-key
      remoteRef:
        key: prod/prompt-builder/anthropic
```

## Best Practices

1. **Never commit secrets to Git**
   - Use `.gitignore` for `.env` files
   - Use pre-commit hooks to detect secrets
   - Scan regularly with TruffleHog/Gitleaks

2. **Rotate secrets regularly**
   - Set expiration dates
   - Automate rotation where possible
   - Document rotation procedures

3. **Use different secrets per environment**
   - Development
   - Staging
   - Production

4. **Principle of least privilege**
   - Grant minimal permissions
   - Use service accounts
   - Audit access regularly

5. **Encrypt secrets at rest and in transit**
   - Use TLS for transmission
   - Encrypt storage volumes
   - Use managed secret services

## Secret Rotation Procedure

### Anthropic API Key Rotation
1. Generate new API key in Anthropic Console
2. Update secret in secrets manager
3. Deploy new configuration (zero-downtime)
4. Verify new key works
5. Revoke old key
6. Update documentation

### Firebase Configuration Rotation
1. Create new Firebase project configuration
2. Update secrets
3. Deploy changes
4. Verify authentication works
5. Archive old configuration

## Monitoring & Auditing

- Log secret access (not values)
- Alert on unauthorized access attempts
- Regular access reviews
- Failed authentication monitoring

## Emergency Procedures

### Secret Compromise
1. Immediately revoke compromised secret
2. Generate new secret
3. Deploy updated configuration
4. Investigate breach
5. Document incident
6. Review security practices

## Tools

- **Detection**: TruffleHog, Gitleaks, git-secrets
- **Management**: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
- **Kubernetes**: Sealed Secrets, External Secrets Operator
- **CI/CD**: GitHub Secrets, GitLab CI Variables, Azure DevOps Variables
