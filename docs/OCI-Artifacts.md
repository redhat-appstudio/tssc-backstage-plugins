# OCI Artifacts

## What is an OCI artifact?
An **OCI artifact** is a package format that follows the Open Container Initiative (OCI) standard. It allows us to:

- Store and distribute software and related files using container registries (like Quay)
- Maintain compatibility across different tools and platforms
- Package various types of content beyond just containers (such as our plugins)

Think of it like a standardized box that can hold different types of items, making them easier to ship and use across different systems.

## How can we inspect OCI artifacts?

### Docker

1. Pull the image (if not already local)
```bash
docker pull <registery><repository>:<tag>
```

2. Save the image as a Tar file
```bash
docker save -o image.tar <register>/<repository>:tag
```

3. Extract the Tar file
```bash
mkdir extracted && tar -xf image.tar -C extracted
```

4. View the Manifest file
```bash
cat extracted/manifest.json | jq .
```
