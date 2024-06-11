import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../../src';
import {
	getBlockDetailsData,
	getBridgeContractsData,
	getRawBlockTransactionsData,
	getTransactionDetailsData,
} from '../fixtures';

describe('ZkSyncPlugin rpc tests', () => {
	let web3: Web3;

	beforeAll(() => {
		web3 = new Web3('https://sepolia.era.zksync.dev');
		web3.registerPlugin(new ZkSyncPlugin());
	});

	it('l1ChainId', async () => {
		const res = await web3.zkSync.rpc.l1ChainId();
		expect(res).toBe(BigInt(11155111));
	});
	it('getL1BatchNumber', async () => {
		const res = await web3.zkSync.rpc.getL1BatchNumber();
		expect(res).toBeGreaterThan(BigInt(0));
	});
	it('getBlockDetails', async () => {
		const res = await web3.zkSync.rpc.getBlockDetails(getBlockDetailsData.input);
		expect(res).toEqual(getBlockDetailsData.output);
	});
	it('getTransactionDetails', async () => {
		const res = await web3.zkSync.rpc.getTransactionDetails(getTransactionDetailsData.input);
		expect(res).toEqual(getTransactionDetailsData.output);
	});
	it('getBytecodeByHash', async () => {
		const res = await web3.zkSync.rpc.getBytecodeByHash(
			'0x086227fafad2bc4d08a122ebb690d958edcd43352d38d31646968480f496827c',
		);
		expect(res).toBeDefined();
	});
	it('getRawBlockTransactions', async () => {
		const res = await web3.zkSync.rpc.getRawBlockTransactions(getRawBlockTransactionsData.input);
		expect(res).toEqual(getRawBlockTransactionsData.output);
	});
	it('getMainContract', async () => {
		const res = await web3.zkSync.rpc.getMainContract();
		expect(res).toBe('0x9a6de0f62aa270a8bcb1e2610078650d539b1ef9');
	});
	it('getL1BatchBlockRange', async () => {
		const res = await web3.zkSync.rpc.getL1BatchBlockRange(1);
		expect(res).toEqual(['0x1', '0x2']);
	});
	it('getTestnetPaymaster', async () => {
		const res = await web3.zkSync.rpc.getTestnetPaymaster();
		expect(res).toBe('0x3cb2b87d10ac01736a65688f3e0fb1b070b3eea3');
	});
	it('getBridgeContracts', async () => {
		const res = await web3.zkSync.rpc.getBridgeContracts();
		expect(res).toEqual(getBridgeContractsData.output);
	});

	it('estimateGasL1ToL2', async () => {
		const res = await web3.zkSync.rpc.estimateGasL1ToL2({
			from: '0x3cb2b87d10ac01736a65688f3e0fb1b070b3eea3',
			to: '0x9a6de0f62aa270a8bcb1e2610078650d539b1ef9',
		});
		expect(res).toBeGreaterThan(BigInt(0));
	});
});
