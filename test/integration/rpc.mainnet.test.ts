import { Web3 } from 'web3';
import { ethRpcMethods } from 'web3-rpc-methods';
import { ZKsyncPlugin } from '../../src';
import {
	estimateData,
	getL1BatchDetailsData,
	getL2ToL1LogProofData,
	getProofData,
} from '../fixtures';

describe('ZkSyncPlugin rpc mainnet tests', () => {
	let web3: Web3;

	beforeAll(() => {
		web3 = new Web3();
		web3.registerPlugin(new ZKsyncPlugin('https://mainnet.era.zksync.io'));
	});

	it('should get bridge addresses', async () => {
		const res = await web3.ZKsync.L2.getDefaultBridgeAddresses();

		expect(res.erc20L1).toBe('0x57891966931eb4bb6fb81430e6ce0a03aabde063');
		expect(res.erc20L2).toBe('0x11f943b2c77b743ab90f4a0ae7d5a4e7fca3e102');
		expect(res.wethL1).toBe('0x0000000000000000000000000000000000000000');
		expect(res.wethL2).toBe('0x0000000000000000000000000000000000000000');
	});
	it('getL2ToL1LogProof', async () => {
		const res = await web3.ZKsync.rpc.getL2ToL1LogProof(getL2ToL1LogProofData.input);
		expect(res).toEqual(getL2ToL1LogProofData.output);
	});
	it('getProof', async () => {
		const res = await web3.ZKsync.rpc.getProof(...getProofData.input);
		expect(res).toEqual(getProofData.output);
	});
	it('getAllAccountBalances', async () => {
		const res = await web3.ZKsync.rpc.getAllAccountBalances(
			'0x98E9D288743839e96A8005a6B51C770Bbf7788C0',
		);
		expect(Number(res['0x0000000000000000000000000000000000000000'])).toBeGreaterThan(0);
	});
	it('estimateFee', async () => {
		const res = await web3.ZKsync.rpc.estimateFee(estimateData.input);
		expect(Number(res.gas_limit)).toBeGreaterThan(0);
		expect(Number(res.max_fee_per_gas)).toBeGreaterThan(0);
		expect(Number(res.max_priority_fee_per_gas)).toBe(0);
		expect(Number(res.gas_per_pubdata_limit)).toBeGreaterThan(0);
	});
	it('getL1BatchDetails', async () => {
		const res = await web3.ZKsync.rpc.getL1BatchDetails(getL1BatchDetailsData.input);
		expect(res).toEqual(getL1BatchDetailsData.output);
	});
	it('bigint test', async () => {
		const latestBatchIndex = await web3.ZKsync.rpc.getL1BatchNumber();
		const latestBatchDetails = await web3.ZKsync.rpc.getL1BatchDetails(latestBatchIndex);
		const blockDetails = await web3.ZKsync.rpc.getBlockDetails(latestBatchDetails.number);
		expect(blockDetails.number).toBeDefined();
	});
	it('transactionReceipt', async () => {
		const res = await ethRpcMethods.getTransactionReceipt(
			web3.requestManager,
			'0x0cb95fa45e09ace6709276c9531f9a402a5e54a2b5365b673f3d258afac54cd8',
		);
		expect(res?.transactionHash).toBeDefined();
		expect(res?.status).toBe('0x1');
	});
});
