use serde::{Deserialize, Serialize};
use solana_sdk::{
    account::Account,
    hash::{hashv, Hash},
    pubkey::Pubkey,
    transaction::Transaction,
};

#[derive(Deserialize, Serialize, Debug)]
pub struct RampTx {
    pub is_onramp: bool,
    pub user: Pubkey,
    pub amount: u64,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ExecutionInput {
    pub accounts: RollupState,
    pub txs: Vec<Transaction>,
    pub ramp_txs: Vec<RampTx>,
}

pub type ExecutionOutput = Hash;

#[derive(Deserialize, Serialize, Debug)]
pub struct RollupState(pub Vec<(Pubkey, Account)>); // Change Account to AccountSharedData ?

#[derive(Deserialize, Serialize, Debug)]
pub struct CommittedValues {
    pub input: ExecutionInput,
    pub output: ExecutionOutput,
}

// Temporary function used before adding the merklized state
pub fn hash_state(output: RollupState) -> Hash {
    let mut data = Vec::new();
    for (pk, account) in output.0.iter() {
        data.extend_from_slice(pk.as_ref());
        data.extend_from_slice(&bincode::serialize(account).unwrap());
    }
    hashv(&[data.as_slice()])
}
