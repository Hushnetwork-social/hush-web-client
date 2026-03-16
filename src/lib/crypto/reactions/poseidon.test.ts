import { describe, expect, it } from "vitest";

import { computeCommitment, computeNullifier, poseidonHash, uuidToBigint } from "./poseidon";

describe("poseidon reactions vectors", () => {
  it("matches the known nullifier vector used by the reaction circuit", async () => {
    const userSecret = 123456789n;
    const scopeId = 222222222222222222n;
    const domain = 1213481800n;

    const direct = await poseidonHash([userSecret, scopeId, scopeId, domain]);
    const nullifier = await computeNullifier(userSecret, scopeId, scopeId);

    expect(direct.toString()).toBe("13389713634959384603415130667726469622391367961139549843690504442816708766317");
    expect(nullifier).toBe(direct);
  });

  it("matches the known commitment vector used by the reaction circuit", async () => {
    const commitment = await computeCommitment(123456789n);
    expect(commitment.toString()).toBe("7110303097080024260800444665787206606103183587082596139871399733998958991511");
  });

  it("converts UUIDs using .NET Guid byte order", () => {
    expect(uuidToBigint("e0fd1578-0f58-4515-bc00-6cc6d887da95").toString())
      .toBe("159621546952210178404125881379307641493");
  });
});
