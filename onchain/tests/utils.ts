import * as borsh from "borsh";
import * as anchor from "@coral-xyz/anchor";
import { ZkBridge } from "../target/types/zk_bridge";

export const PLATFORM_SEED_PREFIX = Buffer.from("platform");
export const COMMIT_SEED_PREFIX = Buffer.from("commit");
export const RAMP_SEED_PREFIX = Buffer.from("ramp");

// Define the structure of OnChainProof in TypeScript
export class OnChainProof {
  publicValues: Uint8Array;
  proof: Uint8Array;

  static schema: borsh.Schema = {
    struct: {
      publicValues: { array: { type: "u8" } },
      proof: { array: { type: "u8" } },
    },
  };
}

interface UploadCommitParams {
  // onchainProof: OnChainProof;
  onchainPublicValues: Uint8Array;
  program: anchor.Program<ZkBridge>;
  platformId: anchor.web3.PublicKey;
  senderKeypair: anchor.web3.Keypair;
}
export async function uploadCommit({
  // onchainProof,
  onchainPublicValues,
  program,
  platformId,
  senderKeypair,
}: UploadCommitParams) {
  const [platformKey, _platformBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(PLATFORM_SEED_PREFIX), platformId.toBuffer()],
      program.programId
    );

  // Upload commit
  const [commitKey, _commitBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMIT_SEED_PREFIX),
      platformId.toBuffer(),
      senderKeypair.publicKey.toBuffer(),
    ],
    program.programId
  );

  let dataLeft = new Uint8Array(onchainPublicValues.length);
  for (let i = 0; i < onchainPublicValues.length; i++) {
		dataLeft[i] = onchainPublicValues[i];
	}

  let offset = 0;
  while (dataLeft.length > 0) {
    const size = Math.min(dataLeft.length, 800);
    await program.methods
			.uploadCommit({
				commitSize: new anchor.BN(onchainPublicValues.length),
				offset: new anchor.BN(offset),
				commitData: Buffer.from(dataLeft.subarray(0, size)),
			})
			.accountsPartial({
				prover: senderKeypair.publicKey,
				commit: commitKey,
				platform: platformKey,
			})
			.signers([senderKeypair])
			.rpc();

    dataLeft = dataLeft.subarray(size);
    offset += size;
  }

  return commitKey;
}
