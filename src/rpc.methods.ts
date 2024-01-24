import {Web3RequestManager} from "web3-core";
import {BatchDetails, BlockDetails, RawBlockTransaction, TransactionDetails} from "./types";
import {Address, Bytes, HexString32Bytes, Numbers, TransactionWithSenderAPI} from "web3";

// Here is ZkSync methods describing here https://docs.zksync.io/build/api.html

export class RpcMethods {
    requestManager: Web3RequestManager<unknown>;

    constructor(requestManager: Web3RequestManager<unknown>) {
        this.requestManager = requestManager;
    }

    private _send(method: string, params: unknown[]): Promise<any> {
        return this.requestManager.send({
            method,
            params,
        });
    }

    public async l1ChainId(): Promise<number> {
        const res = await this._send("zks_L1ChainId", []);
        return Number(res);
    }

    public async getL1BatchNumber(): Promise<number> {
        const number = await this._send("zks_L1BatchNumber", []);
        return Number(number);
    }

    public async getL1BatchDetails(number: number): Promise<BatchDetails> {
        return await this._send("zks_getL1BatchDetails", [number]);
    }

    public async getBlockDetails(number: number): Promise<BlockDetails> {
        return await this._send("zks_getBlockDetails", [number]);
    }

    public async getTransactionDetails(txHash: Bytes): Promise<TransactionDetails> {
        return await this._send("zks_getTransactionDetails", [txHash]);
    }

    public async getBytecodeByHash(bytecodeHash: Bytes): Promise<Uint8Array> {
        return await this._send("zks_getBytecodeByHash", [bytecodeHash]);
    }

    public async getRawBlockTransactions(number: number): Promise<RawBlockTransaction[]> {
        return await this._send("zks_getRawBlockTransactions", [number]);
    }

    public async estimateGasFee(transaction: Partial<TransactionWithSenderAPI>) {
        return await this._send("zks_estimateGasFee", [transaction]);
    }

    public async estimateGasL1ToL2(transaction: Partial<TransactionWithSenderAPI>) {
        return await this._send("zks_estimateGasL1ToL2", [transaction]);
    }

    public async getAllAccountBalances(address: Address) {
        return await this._send("zks_getAllAccountBalances", [address]);
    }

    public async getMainContract() {
        return await this._send("zks_getMainContract", []);
    }

    public async getL1BatchBlockRange(number: number) {
        return await this._send("zks_getL1BatchBlockRange", [number]);
    }

    public async getProof(address: Address, keys: string[], l1BatchNumber: number) {
        return await this._send("zks_getProof", [address, keys, l1BatchNumber]);
    }

    public async getL2ToL1MsgProof(block: Numbers, sender: Address, msg: HexString32Bytes, l2LogPosition: Numbers) {
        return await this._send("zks_getL2ToL1MsgProof", [block, sender, msg, l2LogPosition]);
    }

    public async getTestnetPaymaster() {
        return await this._send("zks_getTestnetPaymaster", []);
    }

    public async getL2ToL1LogProof(txHash: HexString32Bytes, l2ToL1LogIndex?: number) {
        const params: [HexString32Bytes, number?] = [txHash]
        if (l2ToL1LogIndex) {
            params.push(l2ToL1LogIndex)
        }
        return await this._send("zks_getL2ToL1LogProof", params);
    }

    public async getBridgeContracts(): Promise<{
        l1Erc20DefaultBridge: Address
        l2Erc20DefaultBridge: Address
        l1WethBridge: Address
        l2WethBridge: Address
    }> {
        return await this._send("zks_getBridgeContracts", []);
    }
}
