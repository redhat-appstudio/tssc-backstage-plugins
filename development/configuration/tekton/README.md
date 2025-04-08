# Tekton

Bootstrap Tekton Pipelines and Pipeline Runs for local testing.

Make sure you have some way of running K8s locally:
- [Kind](https://kind.sigs.k8s.io/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/?arch=%2Flinux%2Fx86-64%2Fstable%2Fbinary+download)

## Setup

Install Tekton: https://tekton.dev/docs/installation/pipelines/

```bash
# Example
kubectl apply --filename https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml
```

Wait till everything is ready:
```bash
kubectl wait --for=condition=Ready pods --all -n tekton-pipelines --timeout=300s
```

Apply [manifest.yml](./manifest.yml)
```bash
kubectl apply -f https://raw.githubusercontent.com/redhat-appstudio/rhtap-backstage-plugins/refs/heads/main/development/configuration/tekton/manifest.yml
```
Ensure that you have pipelines and pipeline runs listed
```bash
# List pipelines
tkn p list -n tekton-pipelines

# List pipeline runs
tkn pr list -n tekton-pipelines
```

## Configuring RHDH

**NOTE**: This repo already has default configs you can use in RHDH: [configs](../rhdh).

### App config
Fetch the K8s server URL and Service Account token for your RHDH configuration:
```bash
# Server URL
kubectl config view -o jsonpath='{.clusters[0].cluster.server}'

# SA token, decoded
kubectl get secret backstage-tekton-token -n tekton-pipelines -o jsonpath='{.data.token}' | base64 -d

```

In your plugin's `app-config.local.yaml` file (create one if it doesn't exist) add the following:
```yaml
kubernetes:
  # see https://backstage.io/docs/features/kubernetes/configuration for kubernetes configuration options
  serviceLocatorMethod:
    type: 'singleTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - name: rhtap
          authProvider: serviceAccount
          # kubectl config view -o jsonpath='{.clusters[0].cluster.server}'
          url: <k8s-server-url>
          # kubectl get secret backstage-tekton-token -n tekton-pipelines -o jsonpath='{.data.token}' | base64 --decode
          serviceAccountToken: <service-account-token>
          skipTLSVerify: true
          skipMetricsLookup: true
          customResources:
            - group: tekton.dev
              apiVersion: v1
              plural: pipelineruns
            - group: tekton.dev
              apiVersion: v1
              plural: taskruns
```

### Component

For your Component's definition you can add the following:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: tekton-demo
  namespace: development
  annotations:
    tekton.dev/cicd: 'true'
    # It's important that your Tekton CRs have this annotation. If not they wont appear.
    backstage.io/kubernetes-id: 'rhtap'
    backstage.io/kubernetes-namespace: 'tekton-pipelines'
```
