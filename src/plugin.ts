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
		Generic: {
			/**
			 * The web3.js Contract instance for the `IERC20` interface, which is utilized for interacting with ERC20 tokens.
			 */
			IERC20Contract: Contract<typeof IERC20ABI>;
			/**
			 * The web3.js Contract instance for the `IERC1271` interface, which is utilized for signature validation by contracts.
			 */
			IERC1271Contract: Contract<typeof IERC1271ABI>;
		};
		L1: {
			/**
			 * The web3.js Contract instance for the `ZkSync` interface.
			 */
			ZkSyncMainContract: Contract<typeof IZkSyncABI>;
			/**
			 * The ABI of the `Bridgehub` interface.
			 */
			BridgehubContract: Contract<typeof IBridgehubABI>;
			/**
			 * The web3.js Contract instance for the `IL1Bridge` interface, which is utilized for transferring ERC20 tokens from L1 to L2.
			 */
			L1BridgeContract: Contract<typeof IL1BridgeABI>;
		};
		L2: {
			/**
			 * The web3.js Contract instance for the `IContractDeployer` interface, which is utilized for deploying smart contracts.
			 */
			ContractDeployerContract: Contract<typeof IContractDeployerABI>;
			/**
			 * The web3.js Contract instance for the `IL1Messenger` interface, which is utilized for sending messages from the L2 to L1.
			 */
			L1MessengerContract: Contract<typeof IL1MessengerABI>;
			/**
			 * The web3.js Contract instance for the `IL2Bridge` interface, which is utilized for transferring ERC20 tokens from L2 to L1.
			 */
			L2BridgeContract: Contract<typeof IL2BridgeABI>;

			/**
			 * The web3.js Contract instance for the `INonceHolder` interface, which is utilized for managing deployment nonces.
			 */
			NonceHolderContract: Contract<typeof INonceHolderABI>;
		};
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

		// TODO: Chose between this pattern and using this.Contracts...
		this.erc20BridgeL1 = '';
		this.erc20BridgeL2 = '';
		this.wethBridgeL1 = '';
		this.wethBridgeL2 = '';
		this._l2BridgeContracts = {};
		this._erc20Contracts = {};

		// TODO: Rethink the way of initializing contracts, maybe it should be lazy loaded?!
		this.Contracts = {
			Generic: {
				IERC20Contract: new Contract(IERC20ABI),
				IERC1271Contract: new Contract(IERC1271ABI),
			},
			L1: {
				ZkSyncMainContract: new Contract(IZkSyncABI),
				BridgehubContract: new Contract(IBridgehubABI),
				L1BridgeContract: new Contract(IL1BridgeABI),
			},
			L2: {
				ContractDeployerContract: new Contract(
					IContractDeployerABI,
					constants.CONTRACT_DEPLOYER_ADDRESS,
					this.providerL2,
				),
				L1MessengerContract: new Contract(
					IL1MessengerABI,
					constants.L1_MESSENGER_ADDRESS,
					this.providerL2,
				),
				NonceHolderContract: new Contract(
					INonceHolderABI,
					constants.NONCE_HOLDER_ADDRESS,
					this.providerL2,
				),
				L2BridgeContract: new Contract(IL2BridgeABI, this.providerL2),
			},
		};

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
			const [mainContract, bridgehubContractAddress, bridgeContracts] = await Promise.all([
				this.rpc.getMainContract(),
				this.rpc.getBridgehubContractAddress(),
				this.rpc.getBridgeContracts(),
			]);

			// mainContract looks like in the ZK Era mainnet: '0x32400084C286CF3E17e7B677ea9583e60a000324'
			this.Contracts.L1.ZkSyncMainContract.options.address = mainContract;
			// mainContract looks like in the ZK Era mainnet: '0x303a465B659cBB0ab36eE643eA362c509EEb5213'
			this.Contracts.L1.BridgehubContract.options.address = bridgehubContractAddress;

			// bridgeContracts object looks like in the ZK Era mainnet:
			// {
			// 	l1Erc20DefaultBridge: '0x57891966931eb4bb6fb81430e6ce0a03aabde063',
			// 	l1WethBridge: '0x0000000000000000000000000000000000000000',
			// 	l2Erc20DefaultBridge: '0x11f943b2c77b743ab90f4a0ae7d5a4e7fca3e102',
			// 	l2WethBridge: '0x0000000000000000000000000000000000000000'
			// }
			this.Contracts.L1.L1BridgeContract.options.address = bridgeContracts.l1Erc20DefaultBridge;
			this.Contracts.L2.L2BridgeContract.options.address = bridgeContracts.l2Erc20DefaultBridge;

			return true;
		} catch (e) {
			return false;
		}
	}

	public link(parentContext: Web3Context): void {
		super.link(parentContext);

		this.web3 = parentContext as Web3;

		// Pass the parentContext to the corresponding L1 contracts
		this.Contracts.L1.ZkSyncMainContract.link<any>(parentContext);
		this.Contracts.L1.BridgehubContract.link<any>(parentContext);
		this.Contracts.L1.L1BridgeContract.link<any>(parentContext);

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
	 * Get the L1 address of a token
	 * @param token - The address of the token
	 */
	async getL1Address(token: Address): Promise<Address> {
		if (token == constants.ETH_ADDRESS) {
			return constants.ETH_ADDRESS;
		} else {
			const bridgeAddresses = await this.providerL2.getDefaultBridgeAddresses();
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
			const bridgeAddresses = await this.providerL2.getDefaultBridgeAddresses();
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
