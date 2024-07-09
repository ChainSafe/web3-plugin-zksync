import type { Transaction } from 'web3-types';
import { ethRpcMethods } from 'web3-rpc-methods';

import { Web3ZkSyncL2, Web3ZkSyncL1 } from '../../src';
import { getPriorityOpResponse } from '../../src/utils';
import { PriorityL1OpResponse } from '../../src/types';

jest.mock('web3-rpc-methods');

describe('Web3ZkSyncL2 as a Provider', () => {
	it.skip('should correctly initialize and assign function properties in getPriorityOpResponse', async () => {
		const web3ZkSyncL2 = new Web3ZkSyncL2('https://mainnet.era.zksync.io');
		const acc = web3ZkSyncL2.eth.accounts.privateKeyToAccount(
			'0x1f953dc9b6437fb94fcafa5dabe3faa0c34315b954dd66f41bf53273339c6d26',
		);
		web3ZkSyncL2.eth.accounts.wallet.add(acc);
		// TODO: remove the commented lines after the test passes
		// NOTE: this was an object of TransactionResponse in ethers
		const l1Tx: Transaction = {
			// hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
			from: acc.address,
			// blockHash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
			// blockNumber: 123456,
			to: '0xabcdef1234567890abcdef1234567890abcdef12',
			type: 0,
			nonce: 42,
			gasLimit: 2000000n,
			// index: 3,
			gasPrice: 1000000000n,
			// data: '0x',
			value: 0n,
			chainId: 1337n,
			// // not used in tested code, keep the test simple
			// signature: null as unknown as Signature,
		};

		// mock ethRpcMethods.sendTransaction
		jest.spyOn(ethRpcMethods, 'sendTransaction').mockResolvedValue('');
		// @ts-ignore
		jest.spyOn(ethRpcMethods, 'signTransaction').mockResolvedValue({
			// @ts-ignore
			raw: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
		});

		const signed = await web3ZkSyncL2.signTransaction(l1Tx);

		const txPromise = web3ZkSyncL2.sendRawTransaction(signed);

		const priorityOpResponse = await getPriorityOpResponse(new Web3ZkSyncL1(), txPromise);
		// 'The waitL1Commit function should be properly initialized'
		expect(typeof (priorityOpResponse as PriorityL1OpResponse).waitL1Commit).toEqual(
			'function',
		);
		// 'The wait function should be properly initialized'
		expect(typeof priorityOpResponse.wait).toBe('function');
		// 'The waitFinalize function should be properly initialized'
		expect(typeof priorityOpResponse.waitFinalize).toEqual('function');
	});
});
