export type DependencyMap = Record<string, string>;
export type PackageJson = {
  name: string
  version: string
  backstage: Record<string, any>
  homepage: string
  repository: Record<string, any>
  license: string
  author: string
  bugs: string
  keywords: string[]
  dependencies: DependencyMap
  devDependencies: DependencyMap
  peerDependencies: DependencyMap

};
export type HeadersInit = Headers | Record<string, string> | undefined;
export type Workspace = "argocd" | "tekton" | "quay" | "multi-source-security-viewer";

export type CliArgs = {
  version: string;
  target?: string;
  debug: boolean;
}
export const ALLOWED_FLAGS = new Set(["version", "target", "debug"]);
export const STRING_FLAGS = new Set<keyof CliArgs>(["version", "target"]);
export const BOOLEAN_FLAGS = new Set<keyof CliArgs>(["debug"]);

