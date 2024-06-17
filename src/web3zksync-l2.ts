// import type { Web3ContextInitOptions } from 'web3-core';
// import { Web3Eth } from 'web3-eth';
// import * as web3Utils from 'web3-utils';
// import type { Address, HexString } from 'web3';

import { Network as ZkSyncNetwork } from './types';
import { Web3ZkSync } from './web3zksync';

// Equivalent to both Provider and Signer in zksync-ethers
export class Web3ZkSyncL2 extends Web3ZkSync {
	// protected _contractAddresses: {
	// 	mainContract?: Address;
	// 	erc20BridgeL1?: Address;
	// 	erc20BridgeL2?: Address;
	// 	wethBridgeL1?: Address;
	// 	wethBridgeL2?: Address;
	// };

	// override contractAddresses(): {
	// 	mainContract?: Address;
	// 	erc20BridgeL1?: Address;
	// 	erc20BridgeL2?: Address;
	// 	wethBridgeL1?: Address;
	// 	wethBridgeL2?: Address;
	// } {
	// 	return this._contractAddresses;
	// }

	// /**
	//  * Creates a new `Provider` instance for connecting to an L2 network.
	//  * Caching is disabled for local networks.
	//  * @param [url] The network RPC URL. Defaults to the local network.
	//  * @param [network] The network name, chain ID, or object with network details.
	//  * @param [options] Additional options for the provider.
	//  */
	// constructor(url?: ethers.FetchRequest | string, network?: Networkish, options?: any) {
	// 	if (!url) {
	// 		url = 'http://localhost:3050';
	// 	}

	// 	const isLocalNetwork =
	// 		typeof url === 'string'
	// 			? url.includes('localhost') || url.includes('127.0.0.1')
	// 			: url.url.includes('localhost') || url.url.includes('127.0.0.1');

	// 	const optionsWithDisabledCache = isLocalNetwork ? { ...options, cacheTimeout: -1 } : options;

	// 	super(url, network, optionsWithDisabledCache);
	// 	typeof url === 'string'
	// 		? (this.#connect = new FetchRequest(url))
	// 		: (this.#connect = url.clone());
	// 	this.pollingInterval = 500;
	// 	this._contractAddresses = {};
	// }

	// override async _send(
	// 	payload: JsonRpcPayload | Array<JsonRpcPayload>,
	// ): Promise<Array<JsonRpcResult>> {
	// 	const request = this._getConnection();
	// 	request.body = JSON.stringify(payload);
	// 	request.setHeader('content-type', 'application/json');

	// 	const response = await request.send();
	// 	response.assertOk();

	// 	let resp = response.bodyJson;
	// 	if (!Array.isArray(resp)) {
	// 		resp = [resp];
	// 	}

	// 	return resp;
	// }

	/**
	 * Creates a new `Provider` from provided URL or network name.
	 *
	 * @param zksyncNetwork The type of zkSync network.
	 *
	 * @example
	 *
	 * import { initWithDefaultProvider, types } from "web3-plugin-zksync";
	 *
	 * const provider = ZkSyncNetwork.initWithDefaultProvider(types.Network.Sepolia);
	 */
	static initWithDefaultProvider(
		zksyncNetwork: ZkSyncNetwork = ZkSyncNetwork.Localhost,
	): Web3ZkSync {
		switch (zksyncNetwork) {
			case ZkSyncNetwork.Localhost:
				return new Web3ZkSync('http://localhost:3050');
			case ZkSyncNetwork.Sepolia:
				return new Web3ZkSync('https://sepolia.era.zksync.dev');
			case ZkSyncNetwork.Mainnet:
				return new Web3ZkSync('https://mainnet.era.zksync.io');
			case ZkSyncNetwork.EraTestNode:
				return new Web3ZkSync('http://localhost:8011');
			default:
				return new Web3ZkSync('http://localhost:3050');
		}
	}
}
