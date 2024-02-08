import type { Address } from 'web3';
import { Web3PluginBase, Contract } from 'web3';
import type { Web3RequestManager } from 'web3-core';
import { ERC20TokenAbi } from './contracts/ERC20Token';
import { RpcMethods } from './rpc.methods';
import { ETH_ADDRESS, ZERO_ADDRESS } from './constants';
import { L2BridgeAbi } from './contracts/L2Bridge';

export class ZkSyncPlugin extends Web3PluginBase {
	public pluginNamespace = 'zkSync';
	public erc20BridgeL1: string;
	public erc20BridgeL2: string;
	public wethBridgeL1: string;
	public wethBridgeL2: string;
	public _rpc?: RpcMethods;
	public _l2BridgeContracts: Record<Address, Contract<typeof L2BridgeAbi>>;
	public _erc20Contracts: Record<Address, Contract<typeof ERC20TokenAbi>>;

	constructor() {
		super();

		this.erc20BridgeL1 = '';
		this.erc20BridgeL2 = '';
		this.wethBridgeL1 = '';
		this.wethBridgeL2 = '';
		this._l2BridgeContracts = {};
		this._erc20Contracts = {};
	}

	/**
	 * Get RPC methods instance
	 */
	get rpc(): RpcMethods {
		if (!this._rpc) {
			this._rpc = new RpcMethods(
				this.requestManager as unknown as Web3RequestManager<unknown>,
			);
		}
		return this._rpc;
	}

	/**
	 * Get L2 bridge contract instance
	 * @param address - Contract address
	 */
	getL2BridgeContract(address: Address): Contract<typeof L2BridgeAbi> {
		if (!this._l2BridgeContracts[address]) {
			this._l2BridgeContracts[address] = new Contract(L2BridgeAbi, address);
			this._l2BridgeContracts[address].link(this);
		}
		return this._l2BridgeContracts[address];
	}

	/**
	 * Get the ERC20 contract instance
	 * @param address - Contract address
	 */
	erc20(address: string): Contract<typeof ERC20TokenAbi> {
		if (!this._erc20Contracts[address]) {
			this._erc20Contracts[address] = new Contract(ERC20TokenAbi, address);
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
		if (token == ETH_ADDRESS) {
			return ETH_ADDRESS;
		} else {
			const bridgeAddresses = await this.getDefaultBridgeAddresses();
			if (bridgeAddresses.wethL2 !== ZERO_ADDRESS) {
				const l2Bridge = this.getL2BridgeContract(bridgeAddresses.wethL2);
				try {
					const l1Token = await l2Bridge.methods.l1TokenAddress(token).call();
					if (l1Token !== ZERO_ADDRESS) {
						return l1Token;
					}
				} catch (e) {
					throw new Error(
						`Error getting L1 address for token ${token}. ${JSON.stringify(e)}`,
					);
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
		if (token == ETH_ADDRESS) {
			return ETH_ADDRESS;
		} else {
			const bridgeAddresses = await this.getDefaultBridgeAddresses();
			if (bridgeAddresses.wethL2 !== ZERO_ADDRESS) {
				const l2Bridge = this.getL2BridgeContract(bridgeAddresses.wethL2);
				try {
					const l2WethToken = await l2Bridge.methods.l2TokenAddress(token).call();
					if (l2WethToken !== ZERO_ADDRESS) {
						return l2WethToken;
					}
				} catch (e) {
					throw new Error(
						`Error getting L2 address for token ${token}. ${JSON.stringify(e)}`,
					);
				}
			}

			const erc20Bridge = this.getL2BridgeContract(bridgeAddresses.erc20L2);
			return erc20Bridge.methods.l2TokenAddress(token).call();
		}
	}
}

// Module Augmentation
declare module 'web3' {
	interface Web3Context {
		zkSync: ZkSyncPlugin;
	}
}
