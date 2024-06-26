import type { Web3Eth } from 'web3';
import * as web3Accounts from 'web3-eth-accounts';
import type { Web3Account } from 'web3-eth-accounts';
import type * as web3Types from 'web3-types';
import type { Web3ZkSyncL2 } from './web3zksync-l2';
import type { EIP712Signer } from './Eip712';
import { AdapterL1, AdapterL2 } from './adapters';
import type { Address, Eip712Meta, PaymasterParams, TransactionOverrides } from './types';

class Adapters extends AdapterL1 {
	adapterL2: AdapterL2;
	constructor() {
		super();
		this.adapterL2 = new AdapterL2();
		this.adapterL2.getAddress = this.getAddress;
		this.adapterL2._contextL2 = this._contextL2;
	}
	getBalance(token?: Address, blockTag: web3Types.BlockNumberOrTag = 'committed') {
		return this.adapterL2.getBalance(token, blockTag);
	}
	getAllBalances() {
		return this.adapterL2.getAllBalances();
	}
	getDeploymentNonce() {
		return this.adapterL2.getDeploymentNonce();
	}
	getL2BridgeContracts() {
		return this.adapterL2.getL2BridgeContracts();
	}
	_fillCustomData(data: Eip712Meta) {
		return this.adapterL2._fillCustomData(data);
	}
	withdraw(transaction: {
		token: Address;
		amount: web3Types.Numbers;
		to?: Address;
		bridgeAddress?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		return this.adapterL2.withdraw(transaction);
	}
	transfer(transaction: {
		to: Address;
		amount: web3Types.Numbers;
		token?: Address;
		paymasterParams?: PaymasterParams;
		overrides?: TransactionOverrides;
	}) {
		return this.adapterL2.transfer(transaction);
	}
}

export class ZKSyncWallet extends Adapters {
	readonly provider?: Web3ZkSyncL2;
	providerL1?: Web3Eth;
	public eip712!: EIP712Signer;
	public account: Web3Account;

	/**
	 *
	 * @param privateKey The private key of the account.
	 * @param providerL2 The provider instance for connecting to a L2 network.
	 * @param providerL1 The provider instance for connecting to a L1 network.
	 *
	 * @example
	 *
	 * import { Wallet, Provider, types } from "zksync-ethers";
	 * import { ethers } from "ethers";
	 *
	 * const PRIVATE_KEY = "<WALLET_PRIVATE_KEY>";
	 *
	 * const provider = Provider.getDefaultProvider(types.Network.Sepolia);
	 * const ethProvider = ethers.getDefaultProvider("sepolia");
	 * const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);
	 */
	// @ts-ignore
	constructor(
		privateKey: string /* | ethers.SigningKey */,
		providerL2: Web3ZkSyncL2,
		providerL1: Web3Eth,
	) {
		super();

		this.account = web3Accounts.privateKeyToAccount(privateKey);
		this.providerL1 = providerL1;
		this.provider = providerL2;
	}
	protected _contextL1() {
		return this.providerL1!;
	}
	protected _contextL2() {
		return this.provider!;
	}

	getBalanceL1() {
		return super.getBalanceL1();
	}
	getBalance() {
		return super.getBalance();
	}
	getAddress(): any {
		return this.account.address;
	}
	deposit(_arg0: { token: string; to: any; amount: string; refundRecipient: any }) {
		return super.deposit(_arg0);
	}
}
