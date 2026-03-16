declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: unknown,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
  };

  export const wtns: {
    calculate(input: unknown, wasmFile: string, witnessFile: string): Promise<void>;
  };
}
