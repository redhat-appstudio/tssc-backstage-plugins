# Jenkins

Bootstrap a local containerized Jenkins instance for local testing.

## Setup

Start the container in detached mode (background)
```bash
docker compose -f local/docker-compose.yml up -d
```

Grab the admin password
```bash
docker logs jenkins

# It should look something like this:
*************************************************************
*************************************************************
*************************************************************

Jenkins initial setup is required. An admin user has been created and a password generated.
Please use the following password to proceed to installation:

aaabbbcccddd111222333

This may also be found at: /var/jenkins_home/secrets/initialAdminPassword

*************************************************************
*************************************************************
*************************************************************

```

Visit localhost:8080, login, set up your Jenkins instance with suggested plugins.

## Pipeline Setup

For your Jenkins pipeline, you can do the following:
- In the main page click "+ New Item" in the top left of the UI.
- The item name can be backstage and the item type can be an Organization folder
- Under Projects -> Repository Sources click Add then click Single Repository
- For the name you can use "tssc-sample-sbom-scans"
- Under Sources click Add, click Git and then add the following git repository: https://github.com/redhat-appstudio/tssc-sample-sbom-scans.git

You can clone this repository and modify it to your needs. Just make sure to update the repository source to that forked repo on Jenkins.

## API Token

- Click your username on the top right of the UI
- Click Security on the left
- Under "API Token", click "Add new Token"
- Name the token "Backstage", click Generate

Save this token, you'll use it in Backstage.


## Configuring RHDH

**NOTE**: This repo already has default configs you can use in RHDH: [configs](../rhdh).

### App config

Add the following to your `app-config.local.yaml` file:
```yaml
jenkins:
  instances:
    - name: default
      baseUrl: http://localhost:8080
      username: <jenkins-username>
      apiKey: <API-token>
```

### Component

For your Component's definition you can add the following:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: jenkins-demo
  annotations:
    jenkins.io/job-full-name: 'backstage/tssc-sample-sbom-scans'
spec:
  type: website
  lifecycle: experimental
  owner: guests
  system: examples
  providesApis: [example-grpc-api]
```
