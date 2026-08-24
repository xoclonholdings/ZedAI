import type { ZcosArtifactReference } from "../../../shared/zcos-intelligence";

const SEMVER = /^\d+\.\d+\.\d+$/;

export class ZyloArtifactResolver {
  private readonly artifacts = new Map<string, ZcosArtifactReference>();

  constructor(artifacts: ZcosArtifactReference[] = []) {
    for (const artifact of artifacts) this.register(artifact);
  }

  register(artifact: ZcosArtifactReference): void {
    if (artifact.ownerGalaxy !== "ZYLO" || !SEMVER.test(artifact.version)) {
      throw new Error(`Invalid ZYLO artifact reference: ${artifact.id}@${artifact.version}`);
    }
    const key = this.key(artifact.kind, artifact.id, artifact.version);
    if (this.artifacts.has(key)) throw new Error(`ZYLO artifact already registered: ${artifact.id}@${artifact.version}`);
    this.artifacts.set(key, Object.freeze({ ...artifact }));
  }

  resolve(reference: ZcosArtifactReference): ZcosArtifactReference | null {
    return this.artifacts.get(this.key(reference.kind, reference.id, reference.version)) || null;
  }

  private key(kind: string, id: string, version: string): string {
    return `${kind}:${id}@${version}`;
  }
}

export const zyloArtifactResolver = new ZyloArtifactResolver([
  { kind: "skill", id: "reasoning.plan", version: "1.0.0", ownerGalaxy: "ZYLO" },
  { kind: "workflow", id: "research.governed-retrieval", version: "1.0.0", ownerGalaxy: "ZYLO" },
  { kind: "workflow", id: "tasks.approval-gated-execution", version: "1.0.0", ownerGalaxy: "ZYLO" },
  { kind: "workflow", id: "capital.delegate", version: "1.0.0", ownerGalaxy: "ZYLO" },
]);
