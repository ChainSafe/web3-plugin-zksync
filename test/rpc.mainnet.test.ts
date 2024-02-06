import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../src';
import {
	estimateData,
	getL1BatchDetailsData,
	getL2ToL1LogProofData,
	getProofData,
} from './fixtures';

const EXAMPLE_ERC20_TOKEN = {
	address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
	l1Address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
	l2Address: '0x40E56A95F440a07000e474e9E1a1385a5319334a',
	decimals: 18,
};

describe('ZkSyncPlugin rpc mainnet tests', () => {
	let web3: Web3;

	beforeAll(() => {
		web3 = new Web3('https://mainnet.era.zksync.io');
		web3.registerPlugin(new ZkSyncPlugin());
	});

	it('should get bridge addresses', async () => {
		const res = await web3.zkSync.getDefaultBridgeAddresses();

		expect(res.erc20L1).toBe('0x57891966931eb4bb6fb81430e6ce0a03aabde063');
		expect(res.erc20L2).toBe('0x11f943b2c77b743ab90f4a0ae7d5a4e7fca3e102');
		expect(res.wethL1).toBe('0x0000000000000000000000000000000000000000');
		expect(res.wethL2).toBe('0x0000000000000000000000000000000000000000');
	});
	it('should get L1 token address', async () => {
		const res = await web3.zkSync.getL1Address(EXAMPLE_ERC20_TOKEN.address);
		expect(res).toBe(EXAMPLE_ERC20_TOKEN.l1Address);
	});
	it('should get L2 token address', async () => {
		const res = await web3.zkSync.getL2Address(EXAMPLE_ERC20_TOKEN.address);
		expect(res).toBe(EXAMPLE_ERC20_TOKEN.l2Address);
	});

	it('getL2ToL1LogProof', async () => {
		const res = await web3.zkSync.rpc.getL2ToL1LogProof(getL2ToL1LogProofData.input);
		expect(res).toEqual(getL2ToL1LogProofData.output);
	});
	it('getProof', async () => {
		const res = await web3.zkSync.rpc.getProof(...getProofData.input);
		expect(res).toEqual(getProofData.output);
	});
	it('getAllAccountBalances', async () => {
		const res = await web3.zkSync.rpc.getAllAccountBalances(
			'0x98E9D288743839e96A8005a6B51C770Bbf7788C0',
		);
		expect(Number(res['0x0000000000000000000000000000000000000000'])).toBeGreaterThan(0);
	});
	it('estimateFee', async () => {
		const res = await web3.zkSync.rpc.estimateFee(estimateData.input);
		expect(Number(res.gas_limit)).toBeGreaterThan(0);
		expect(Number(res.max_fee_per_gas)).toBeGreaterThan(0);
		expect(Number(res.max_priority_fee_per_gas)).toBe(0);
		expect(Number(res.gas_per_pubdata_limit)).toBeGreaterThan(0);
	});
	it('getL1BatchDetails', async () => {
		const res = await web3.zkSync.rpc.getL1BatchDetails(getL1BatchDetailsData.input);
		expect(res).toEqual(getL1BatchDetailsData.output);
	});
	it('bigint test', async () => {
		const latestBatchIndex = await web3.zkSync.rpc.getL1BatchNumber();
		const latestBatchDetails = await web3.zkSync.rpc.getL1BatchDetails(latestBatchIndex);
		const blockDetails = await web3.zkSync.rpc.getBlockDetails(latestBatchDetails.number);
		expect(blockDetails.number).toBeDefined();
	});
});
