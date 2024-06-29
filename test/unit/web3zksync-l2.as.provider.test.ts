import type { Transaction } from 'web3-types';
import { ethRpcMethods } from 'web3-rpc-methods';

import { Web3ZkSyncL2 } from '../../src';

jest.mock('web3-rpc-methods');

describe('Web3ZkSyncL2 as a Provider', () => {
	it('should correctly initialize and assign function properties in getPriorityOpResponse', async () => {
		const web3ZkSyncL2 = new Web3ZkSyncL2('https://mainnet.era.zksync.io');

		// TODO: remove the commented lines after the test passes
		// NOTE: this was an object of TransactionResponse in ethers
		const l1Tx: Transaction = {
			// hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
			from: '0xabcdef1234567890abcdef1234567890abcdef12',
			// blockHash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
			// blockNumber: 123456,
			to: '0xabcdef1234567890abcdef1234567890abcdef12',
			type: 2,
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

		const l1TxResponse = web3ZkSyncL2.sendTransaction(l1Tx);

		const priorityOpResponse = await web3ZkSyncL2.getPriorityOpResponse(l1TxResponse);
		// 'The waitL1Commit function should be properly initialized'
		expect(typeof priorityOpResponse.waitL1Commit).toEqual('function');
		// 'The wait function should be properly initialized'
		expect(typeof priorityOpResponse.wait).toBe('function');
		// 'The waitFinalize function should be properly initialized'
		expect(typeof priorityOpResponse.waitFinalize).toEqual('function');
	});
});
