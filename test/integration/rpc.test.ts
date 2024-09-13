import { Web3 } from 'web3';
import { ZKsyncPlugin } from '../../src';
import {
	getBlockDetailsData,
	getBridgeContractsData,
	getRawBlockTransactionsData,
	getTransactionDetailsData,
} from '../fixtures';

describe('ZkSyncPlugin rpc tests', () => {
	let web3: Web3;

	beforeAll(() => {
		web3 = new Web3();
		web3.registerPlugin(new ZKsyncPlugin('https://sepolia.era.zksync.dev'));
	});

	it('l1ChainId', async () => {
		const res = await web3.ZKsync.rpc.l1ChainId();
		expect(res).toBe(BigInt(11155111));
	});
	it('getL1BatchNumber', async () => {
		const res = await web3.ZKsync.rpc.getL1BatchNumber();
		expect(res).toBeGreaterThan(BigInt(0));
	});
	it('getBlockDetails', async () => {
		const res = await web3.ZKsync.rpc.getBlockDetails(getBlockDetailsData.input);
		expect(res).toEqual(getBlockDetailsData.output);
	});
	it('getTransactionDetails', async () => {
		const res = await web3.ZKsync.rpc.getTransactionDetails(getTransactionDetailsData.input);
		expect(res).toEqual(getTransactionDetailsData.output);
	});
	it('getBytecodeByHash', async () => {
		const res = await web3.ZKsync.rpc.getBytecodeByHash(
			'0x086227fafad2bc4d08a122ebb690d958edcd43352d38d31646968480f496827c',
		);
		expect(res).toBeDefined();
	});
	it('getRawBlockTransactions', async () => {
		const res = await web3.ZKsync.rpc.getRawBlockTransactions(
			getRawBlockTransactionsData.input,
		);
		expect(res).toEqual(getRawBlockTransactionsData.output);
	});
	it('getMainContract', async () => {
		const res = await web3.ZKsync.rpc.getMainContract();
		expect(res).toBe('0x9a6de0f62aa270a8bcb1e2610078650d539b1ef9');
	});
	it('getL1BatchBlockRange', async () => {
		const res = await web3.ZKsync.rpc.getL1BatchBlockRange(1);
		expect(res).toEqual(['0x1', '0x2']);
	});
	// it('getTestnetPaymaster', async () => {
	// 	const res = await web3.zkSync.rpc.getTestnetPaymaster();
	// 	expect(res).toBe('0x3cb2b87d10ac01736a65688f3e0fb1b070b3eea3');
	// });
	it('getBridgeContracts', async () => {
		const res = await web3.ZKsync.rpc.getBridgeContracts();
		expect(res).toEqual(getBridgeContractsData.output);
	});

	it('estimateGasL1ToL2', async () => {
		const res = await web3.ZKsync.rpc.estimateGasL1ToL2({
			from: '0x3cb2b87d10ac01736a65688f3e0fb1b070b3eea3',
			to: '0x9a6de0f62aa270a8bcb1e2610078650d539b1ef9',
		});
		expect(res).toBeGreaterThan(BigInt(0));
	});

	it('getBridgeHubContract', async () => {
		const res = await web3.ZKsync.rpc.getBridgehubContractAddress();
		expect(res).toEqual('0x35a54c8c757806eb6820629bc82d90e056394c92'); // @todo: set bridge hub contract address
	});

	it('getProtocolVersion', async () => {
		const res = await web3.ZKsync.rpc.getProtocolVersion();
		expect(res.version_id).toBe(24n);
		expect(res.timestamp).toBeDefined();
		expect(res.base_system_contracts).toBeDefined();
		expect(res.l2_system_upgrade_tx_hash).toBeDefined();
		expect(res.verification_keys_hashes).toBeDefined();
	});
	it('getFeeParams', async () => {
		const res = await web3.ZKsync.rpc.getFeeParams();
		expect(res.V2).toBeDefined();
		expect(res.V2.config).toBeDefined();
		expect(res.V2.config.compute_overhead_part).toBeDefined();
		expect(res.V2.config.batch_overhead_l1_gas).toBeGreaterThan(0n);
		expect(res.V2.config.max_gas_per_batch).toBeGreaterThan(0n);
		expect(res.V2.config.max_pubdata_per_batch).toBeGreaterThan(0n);
		expect(res.V2.config.minimal_l2_gas_price).toBeGreaterThan(0n);
		expect(res.V2.config.pubdata_overhead_part).toBeGreaterThan(0n);
		expect(res.V2.l1_gas_price).toBeGreaterThan(0n);
		expect(res.V2.l1_pubdata_price).toBeGreaterThan(0n);
	});
	it('getL1GasPrice', async () => {
		const res = await web3.ZKsync.rpc.getL1GasPrice();
		expect(res).toBeDefined();
		expect(res).toBeGreaterThan(0n);
	});
	it('getL2ToL1MsgProof', async () => {
		const res = await web3.ZKsync.rpc.getL2ToL1MsgProof(
			3773029,
			'0x81d3ce1a567389f6cb1178a68eb33aa6f081dc52',
			'0x3c53e10c5339a1f9b703de025de094f20c825c2fb3e9373776b9f6bb4fd355e0',
			0,
		);
		console.log('res', res);
	});
	it('getConfirmedTokens', async () => {
		const res = await web3.ZKsync.rpc.getConfirmedTokens(0, 10);
		expect(res).toBeDefined();
		expect(Array.isArray(res)).toBeTruthy();
		expect(res.length).toBeGreaterThan(0);
		expect(res[0].decimals).toBeGreaterThan(0n);
		expect(res[0].l1Address).toBeDefined();
		expect(res[0].l2Address).toBeDefined();
		expect(res[0].name).toBeDefined();
		expect(res[0].symbol).toBeDefined();
	});
});
