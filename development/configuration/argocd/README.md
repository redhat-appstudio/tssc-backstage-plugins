# ArgoCD

Bootstrap a local ArgoCD instance with applications for local testing.

Make sure you have some way of running K8s locally:
- [Kind](https://kind.sigs.k8s.io/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/?arch=%2Flinux%2Fx86-64%2Fstable%2Fbinary+download)

## Setup

Create the following namespaces:

For ArgoCD

```bash
kubectl create namespace argocd
```

For the Demo applications
```bash
kubectl create namespace demo-apps
```

Apply ArgoCD Manifests:

```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Wait for ArgoCD to finish installing
```bash
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

Expose ArgoCD server
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort"}}'
```

Apply sample applications
```bash
kubectl apply -f https://raw.githubusercontent.com/redhat-appstudio/rhtap-backstage-plugins/refs/heads/main/development/configuration/argocd/argocd-apps.yml
```

Get the K8s server URL and ArgoCD service port

Server URL:

**Note**
- Remove the default port at the end of the URL.
- The K8s server returned may not be the first one listed. Change the `clusters` index if needed.

```bash

kubectl config view -o jsonpath='{.clusters[0].cluster.server}'
```

ArgoCD Service Port:
```bash
kubectl get svc argocd-server -n argocd -o jsonpath='{.spec.ports[0].nodePort}'
```

Access the ArgoCD UI
Grab the default admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

url should be `https://<k8s-server-url>:<argocd-svc-port>`

username should be `admin`

## Configuring RHDH

**NOTE**: This repo already has default configs you can use in RHDH: [configs](../rhdh).

### App Config

In your plugin's `app-config.local.yaml` file (create one if it doesn't exist) add the following:
```yaml
argocd:
  localDevelopment: true
  username: admin
  # Get admin password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
  password: <admin-password>
  appLocatorMethods:
    - type: 'config'
      instances:
        - name: rhtap
          # Get K8s URL: kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
          url: <k8s-server-url>
```

### Component

For your Component's definition you can add the following:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: redhat-argocd-app
  annotations:
    argocd/instance-name: rhtap
    argocd/app-name: rhtap-demo
spec:
  type: service
  lifecycle: experimental
  owner: guests
  system: examples
  providesApis: [example-grpc-api]
```
