import type { Web3Eth } from 'web3';
import * as web3Acccounts from 'web3-eth-accounts';
import type { Web3ZkSyncL2 } from './web3zksync-l2';
import type { EIP712Signer } from './Eip712';

export class ZKSyncWallet extends web3Acccounts.Wallet {
	// or extends web3Acccounts.Web3Account
	readonly provider!: Web3ZkSyncL2;
	providerL1?: Web3Eth;
	public eip712!: EIP712Signer;

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
		_privateKey: string /* | ethers.SigningKey */,
		_providerL2?: Web3ZkSyncL2,
		_providerL1?: Web3Eth,
	) {
		// TODO: Implement constructor
	}

	getBalanceL1() {
		throw new Error('Method not implemented.');
	}
	getBalance() {
		throw new Error('Method not implemented.');
	}
	getAddress(): any {
		throw new Error('Method not implemented.');
	}
	deposit(_arg0: { token: string; to: any; amount: string; refundRecipient: any }) {
		throw new Error('Method not implemented.');
	}
}
