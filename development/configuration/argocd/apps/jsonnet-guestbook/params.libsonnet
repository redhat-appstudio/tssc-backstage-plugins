{
  containerPort: 80,
  image: "gcr.io/heptio-images/ks-guestbook-demo:0.2",
  name: "jsonnet-guestbook-ui",
  namespace: "demo-apps",
  replicas: 1,
  servicePort: 80,
  type: "LoadBalancer",
}
