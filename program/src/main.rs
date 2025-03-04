#![no_main]
sp1_zkvm::entrypoint!(main);

// use onchain_types::CommittedValues;
use svm_runner::runner;
use svm_runner_types::{hash_state, ExecutionInput, CommittedValues};

pub fn main() {
    let input = sp1_zkvm::io::read::<ExecutionInput>();

    let output = runner(&input).unwrap();

    println!("input: {:#?}", input.accounts);
    println!("output: {:#?}", output);

    // Commit to the input and output
    // let commit = CommittedValues {
    //     input: input.into(),
    //     output: hash_state(output).to_bytes(),
    // };
    let commit = CommittedValues {
        initial_hash: hash_state(input.accounts),
        ramp_txs: input.ramp_txs,
        final_hash: hash_state(output)
    };
    sp1_zkvm::io::commit(&commit);
}
