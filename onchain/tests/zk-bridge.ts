import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkBridge } from "../target/types/zk_bridge";
import kpAccount from "./keypairAccount.json";
import kpSender from "./keypairSender.json";
import kpReceiver from "./keypairReceiver.json";
import fs from "fs";
import * as borsh from "borsh";
import {
  OnChainProof,
  PLATFORM_SEED_PREFIX,
  RAMP_SEED_PREFIX,
  uploadCommit,
} from "./utils";

describe("zk-bridge", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ZkBridge as Program<ZkBridge>;

  const initialStateHash = "EukGGeg2sN2tETkZQP4kPTQxJQU859P8j5JGNLBKSt87";
  const senderKeypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(kpSender))
  );
  const receiverKeypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(kpReceiver))
  );
  const step1Proof = new Uint8Array(
    fs.readFileSync("../script/onchain-proof.bin")
  );
  const step2Proof = new Uint8Array(
    fs.readFileSync("../script/onchain-proof.bin")
  );

  const onchainProof1 = borsh.deserialize(
    OnChainProof.schema,
    fs.readFileSync("../script/onchain-proof.bin")
  ) as OnChainProof;
  const onchainProof2 = borsh.deserialize(
    OnChainProof.schema,
    fs.readFileSync("../script/onchain-proof.bin")
  ) as OnChainProof;

  it("works end to end!", async () => {
    const platformId = anchor.web3.PublicKey.unique();
    const [platformKey, _platformBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(PLATFORM_SEED_PREFIX), platformId.toBuffer()],
        program.programId
      );
    const [rampKey, _rampBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(RAMP_SEED_PREFIX),
        platformId.toBuffer(),
        senderKeypair.publicKey.toBuffer(),
      ],
      program.programId
    );
    const [receiverRampKey, _receiveirRampBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(RAMP_SEED_PREFIX),
          platformId.toBuffer(),
          receiverKeypair.publicKey.toBuffer(),
        ],
        program.programId
      );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        senderKeypair.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        receiverKeypair.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Airdropped 10 SOL to the sender and receiver"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    await program.methods
      .createPlatform({
        id: platformId,
        initialStateHash: Array.from(Buffer.from(initialStateHash)),
      })
      .accountsPartial({
        sequencer: senderKeypair.publicKey,
        platform: platformKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([senderKeypair])
      .rpc();
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Sender initialized the rollup platform"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    await program.methods
      .addRampTx({
        isOnramp: true,
        amount: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL),
      })
      .accountsPartial({
        ramper: senderKeypair.publicKey,
        ramp: rampKey,
        platform: platformKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([senderKeypair])
      .rpc();
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Sender queued 1 SOL to be sent to the rollup"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    // This is hardcoded in the proofs of the test
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Sender sent a Counter program TX on the rollup"
    );
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Sender sent a 0.5 SOL to the receiver"
    );

    // STEP 1: Onramp + Counter TX + Transfer
    const commit1Key = await uploadCommit({
      onchainProof: onchainProof1,
      senderKeypair,
      program,
      platformId,
    });
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Uploaded the commit for the onramp, counter tx and transfer"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    console.log(`proving`);

    await program.methods
      .prove(Buffer.from(onchainProof2.proof))
      .accountsPartial({
        prover: senderKeypair.publicKey,
        commit: commit1Key,
        platform: platformKey,
      })
      .preInstructions([
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 1_400_000,
        }),
      ])
      .signers([senderKeypair])
      .rpc({ skipPreflight: false });
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Successfully verified the proof on Solana"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    // STEP 2: Offramp
    await program.methods
      .addRampTx({
        isOnramp: false,
        amount: new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL),
      })
      .accountsPartial({
        ramper: receiverKeypair.publicKey,
        ramp: receiverRampKey,
        platform: platformKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([receiverKeypair])
      .rpc();
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Receiver queued 0.5 SOL to be withdrawn from the rollup"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    const commit2Key = await uploadCommit({
      onchainProof: onchainProof2,
      senderKeypair,
      program,
      platformId,
    });
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Uploaded the commit for the offramp"
    );

    await program.methods
      .prove(Buffer.from(onchainProof2.proof))
      .accountsPartial({
        prover: senderKeypair.publicKey,
        commit: commit2Key,
        platform: platformKey,
      })
      .preInstructions([
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 1_400_000,
        }),
      ])
      .signers([senderKeypair])
      .rpc({ skipPreflight: false });
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Successfully verified the proof on Solana"
    );
    console.log(
      "Current sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Current receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL,
      "\n"
    );

    await program.methods
      .withdraw({ amount: new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL) })
      .accountsPartial({
        ramper: receiverKeypair.publicKey,
        platform: platformKey,
        ramp: receiverRampKey,
      })
      .signers([receiverKeypair])
      .rpc();
    console.log(
      "\x1b[32m%s\x1b[0m",
      "✔",
      "Receiver withdrew 0.5 SOL on Solana"
    );

    console.log(
      "Final sender balance: ",
      (await provider.connection.getBalance(senderKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
    console.log(
      "Final receiver balance: ",
      (await provider.connection.getBalance(receiverKeypair.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
  });
});
