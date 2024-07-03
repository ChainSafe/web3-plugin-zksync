import type { Web3 } from 'web3';
import type { Web3Context, Web3ContextInitOptions, Web3RequestManager } from 'web3-core';
import type * as web3Types from 'web3-types';
import type { Address } from 'web3-types';
import { Contract } from 'web3-eth-contract';
import { Web3PluginBase } from 'web3-core';

import { TransactionFactory } from 'web3-eth-accounts';
import { IERC20ABI } from './contracts/IERC20';
import { RpcMethods } from './rpc.methods';
import * as constants from './constants';
import { IL2BridgeABI } from './contracts/IL2Bridge';
import { IZkSyncABI } from './contracts/IZkSyncStateTransition';
import { IBridgehubABI } from './contracts/IBridgehub';
import { IContractDeployerABI } from './contracts/IContractDeployer';
import { IL1MessengerABI } from './contracts/IL1Messenger';
import { IERC1271ABI } from './contracts/IERC1271';
import { IL1BridgeABI } from './contracts/IL1ERC20Bridge';
import { INonceHolderABI } from './contracts/INonceHolder';
import { EIP712Transaction } from './Eip712';
import { ZKSyncWallet } from './zksync-wallet';
import { Web3ZkSyncL2 } from './web3zksync-l2';
import { Web3ZkSyncL1 } from './web3zksync-l1';

interface ZKSyncWalletConstructor {
	new (privateKey: string): ZKSyncWallet;
}

export class ZkSyncPlugin extends Web3PluginBase {
	private web3: Web3;
	private providerL2: Web3ZkSyncL2;
	public pluginNamespace = 'zkSync';
	public erc20BridgeL1: string;
	public erc20BridgeL2: string;
	public wethBridgeL1: string;
	public wethBridgeL2: string;
	public _rpc?: RpcMethods;
	public _l2BridgeContracts: Record<Address, Contract<typeof IL2BridgeABI>>;
	public _erc20Contracts: Record<Address, Contract<typeof IERC20ABI>>;
	public Contracts: {
		// TODO: Organize these contracts in L1 and L2 groups
		L1: {};
		L2: {};
		/**
		 * The web3.js Contract instance for the `ZkSync` interface.
		 */
		ZkSyncMainContract: Contract<typeof IZkSyncABI>;
		/**
		 * The ABI of the `Bridgehub` interface.
		 */
		BridgehubContract: Contract<typeof IBridgehubABI>;
		/**
		 * The web3.js Contract instance for the `IContractDeployer` interface, which is utilized for deploying smart contracts.
		 */
		ContractDeployerContract: Contract<typeof IContractDeployerABI>;
		/**
		 * The web3.js Contract instance for the `IL1Messenger` interface, which is utilized for sending messages from the L2 to L1.
		 */
		L1MessengerContract: Contract<typeof IL1MessengerABI>;
		/**
		 * The web3.js Contract instance for the `IERC20` interface, which is utilized for interacting with ERC20 tokens.
		 */
		IERC20Contract: Contract<typeof IERC20ABI>;
		/**
		 * The web3.js Contract instance for the `IERC1271` interface, which is utilized for signature validation by contracts.
		 */
		IERC1271Contract: Contract<typeof IERC1271ABI>;
		/**
		 * The web3.js Contract instance for the `IL1Bridge` interface, which is utilized for transferring ERC20 tokens from L1 to L2.
		 */
		L1BridgeContract: Contract<typeof IL1BridgeABI>;

		/**
		 * The web3.js Contract instance for the `IL2Bridge` interface, which is utilized for transferring ERC20 tokens from L2 to L1.
		 */
		L2BridgeContract: Contract<typeof IL2BridgeABI>;

		/**
		 * The web3.js Contract instance for the `INonceHolder` interface, which is utilized for managing deployment nonces.
		 */
		NonceHolderContract: Contract<typeof INonceHolderABI>;
	};
	ZKSyncWallet: ZKSyncWalletConstructor;

	constructor(
		providerOrContextL2: web3Types.SupportedProviders<any> | Web3ContextInitOptions | string,
	) {
		super();
		if (providerOrContextL2 instanceof Web3ZkSyncL2) {
			this.providerL2 = providerOrContextL2;
		} else {
			this.providerL2 = new Web3ZkSyncL2(providerOrContextL2);
		}
		// @ts-ignore-next-line
		TransactionFactory.registerTransactionType(constants.EIP712_TX_TYPE, EIP712Transaction);
		this.erc20BridgeL1 = '';
		this.erc20BridgeL2 = '';
		this.wethBridgeL1 = '';
		this.wethBridgeL2 = '';
		this._l2BridgeContracts = {};
		this._erc20Contracts = {};
		this.Contracts = {
			// TODO: Organize these contracts in L1 and L2 groups
			// and pass the providerL2 to the corresponding contracts
			L1: {},
			L2: {},
			ZkSyncMainContract: new Contract(IZkSyncABI, ''),
			BridgehubContract: new Contract(IBridgehubABI, ''),
			ContractDeployerContract: new Contract(IContractDeployerABI, ''),
			L1MessengerContract: new Contract(IL1MessengerABI, ''),
			IERC20Contract: new Contract(IERC20ABI, ''),
			IERC1271Contract: new Contract(IERC1271ABI, ''),
			L1BridgeContract: new Contract(IL1BridgeABI, ''),
			L2BridgeContract: new Contract(IL2BridgeABI, ''),
			NonceHolderContract: new Contract(INonceHolderABI, ''),
		};

		// this.wallet = (privateKey: string, providerL2?: Web3ZkSyncL2) => {
		// 	return new ZKSyncWallet(privateKey, providerL2, this.web3);
		// };

		this.ZKSyncWallet = (() => {
			throw new Error('Web3 instance is not yet linked to ZkSync plugin');
		}) as unknown as ZKSyncWalletConstructor;

		this.web3 = (() => {
			throw new Error('Web3 instance is not yet linked to ZkSync plugin');
		}) as unknown as Web3;

		this.tryFillContractsAddresses();
	}

	/**
	 * Try to fill the contract addresses
	 * @returns True if the contract addresses were successfully filled, false otherwise
	 */
	public async tryFillContractsAddresses() {
		try {
			// TODO: double check the contract addresses assignments.
			// and do we need to assign to IERC20Contract and IERC1271Contract or are n't they generic?

			this.Contracts.ContractDeployerContract.options.address = constants.CONTRACT_DEPLOYER_ADDRESS;
			this.Contracts.L1MessengerContract.options.address = constants.L1_MESSENGER_ADDRESS;
			// this.Contracts.IERC20Contract.options.address =
			// this.Contracts.IERC1271Contract.options.address =
			this.Contracts.NonceHolderContract.options.address = constants.NONCE_HOLDER_ADDRESS;

			const bridgehubContractAddress = await this.rpc.getBridgehubContractAddress();
			this.Contracts.BridgehubContract.options.address = bridgehubContractAddress;

			const mainContract = await this.rpc.getMainContract();
			this.Contracts.ZkSyncMainContract.options.address = mainContract;

			const bridgeContracts = await this.rpc.getBridgeContracts();
			// console.log('bridgeContracts', bridgeContracts);
			// in Mainnet, the bridgeContracts object looks like:
			// {
			// 	l1Erc20DefaultBridge: '0x57891966931eb4bb6fb81430e6ce0a03aabde063',
			// 	l1WethBridge: '0x0000000000000000000000000000000000000000',
			// 	l2Erc20DefaultBridge: '0x11f943b2c77b743ab90f4a0ae7d5a4e7fca3e102',
			// 	l2WethBridge: '0x0000000000000000000000000000000000000000'
			// }
			this.Contracts.L2BridgeContract.options.address = bridgeContracts.l2Erc20DefaultBridge;
			this.Contracts.L1BridgeContract.options.address = bridgeContracts.l1Erc20DefaultBridge;
			return true;
		} catch (e) {
			return false;
		}
	}

	public link(parentContext: Web3Context): void {
		super.link(parentContext);

		this.web3 = parentContext as Web3;

		// TODO: After these contracts are organized in L1 and L2 groups,
		//  pass the parentContext to the corresponding L1 contracts
		this.Contracts.ZkSyncMainContract.link<any>(parentContext);
		this.Contracts.BridgehubContract.link<any>(parentContext);
		this.Contracts.ContractDeployerContract.link<any>(parentContext);
		this.Contracts.L1MessengerContract.link<any>(parentContext);
		this.Contracts.IERC20Contract.link<any>(parentContext);
		this.Contracts.IERC1271Contract.link<any>(parentContext);
		this.Contracts.L1BridgeContract.link<any>(parentContext);
		this.Contracts.L2BridgeContract.link<any>(parentContext);
		this.Contracts.NonceHolderContract.link<any>(parentContext);

		const self = this;
		class ZKSyncWalletWithFullContext extends ZKSyncWallet {
			constructor(privateKey: string) {
				super(privateKey, self.providerL2, new Web3ZkSyncL1(self.web3.provider));
			}
		}

		this.ZKSyncWallet = ZKSyncWalletWithFullContext;
	}

	/**
	 * Get RPC methods instance
	 */
	get rpc(): RpcMethods {
		if (!this._rpc) {
			this._rpc = new RpcMethods(
				this.providerL2.requestManager as unknown as Web3RequestManager<unknown>,
			);
		}
		return this._rpc;
	}

	/**
	 * Get L2 bridge contract instance
	 * @param address - Contract address
	 */
	getL2BridgeContract(address: Address): Contract<typeof IL2BridgeABI> {
		if (!this._l2BridgeContracts[address]) {
			this._l2BridgeContracts[address] = new Contract(IL2BridgeABI, address);
			this._l2BridgeContracts[address].link(this);
		}
		return this._l2BridgeContracts[address];
	}

	/**
	 * Get the ERC20 contract instance
	 * @param address - Contract address
	 */
	erc20(address: string): Contract<typeof IERC20ABI> {
		if (!this._erc20Contracts[address]) {
			this._erc20Contracts[address] = new Contract(IERC20ABI, address);
			this._erc20Contracts[address].link(this);
		}
		return this._erc20Contracts[address];
	}

	/**
	 * Get the default bridge addresses
	 */
	async getDefaultBridgeAddresses(): Promise<{
		erc20L1: Address;
		erc20L2: Address;
		wethL1: Address;
		wethL2: Address;
	}> {
		if (!this.erc20BridgeL1) {
			const addresses = await this.rpc.getBridgeContracts();
			this.erc20BridgeL1 = addresses.l1Erc20DefaultBridge;
			this.erc20BridgeL2 = addresses.l2Erc20DefaultBridge;
			this.wethBridgeL1 = addresses.l1WethBridge;
			this.wethBridgeL2 = addresses.l2WethBridge;
		}
		return {
			erc20L1: this.erc20BridgeL1,
			erc20L2: this.erc20BridgeL2,
			wethL1: this.wethBridgeL1,
			wethL2: this.wethBridgeL2,
		};
	}

	/**
	 * Get the L1 address of a token
	 * @param token - The address of the token
	 */
	async getL1Address(token: Address): Promise<Address> {
		if (token == constants.ETH_ADDRESS) {
			return constants.ETH_ADDRESS;
		} else {
			const bridgeAddresses = await this.getDefaultBridgeAddresses();
			if (bridgeAddresses.wethL2 !== constants.ZERO_ADDRESS) {
				const l2Bridge = this.getL2BridgeContract(bridgeAddresses.wethL2);
				try {
					const l1Token = await l2Bridge.methods.l1TokenAddress(token).call();
					if (l1Token !== constants.ZERO_ADDRESS) {
						return l1Token;
					}
				} catch (e) {
					throw new Error(`Error getting L1 address for token ${token}. ${JSON.stringify(e)}`);
				}
			}

			const erc20Bridge = this.getL2BridgeContract(bridgeAddresses.erc20L2);
			return erc20Bridge.methods.l1TokenAddress(token).call();
		}
	}

	/**
	 * Get the L2 address of a token
	 * @param token - The address of the token
	 */
	async getL2Address(token: Address): Promise<string> {
		if (token == constants.ETH_ADDRESS) {
			return constants.ETH_ADDRESS;
		} else {
			const bridgeAddresses = await this.getDefaultBridgeAddresses();
			if (bridgeAddresses.wethL2 !== constants.ZERO_ADDRESS) {
				const l2Bridge = this.getL2BridgeContract(bridgeAddresses.wethL2);
				try {
					const l2WethToken = await l2Bridge.methods.l2TokenAddress(token).call();
					if (l2WethToken !== constants.ZERO_ADDRESS) {
						return l2WethToken;
					}
				} catch (e) {
					throw new Error(`Error getting L2 address for token ${token}. ${JSON.stringify(e)}`);
				}
			}

			const erc20Bridge = this.getL2BridgeContract(bridgeAddresses.erc20L2);
			return erc20Bridge.methods.l2TokenAddress(token).call();
		}
	}
}

// Module Augmentation
declare module 'web3' {
	interface Web3 {
		zkSync: ZkSyncPlugin;
	}
}
