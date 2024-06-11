import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../../src';

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

	it('should get L1 token address', async () => {
		const res = await web3.zkSync.getL1Address(EXAMPLE_ERC20_TOKEN.address);
		expect(res).toBe(EXAMPLE_ERC20_TOKEN.l1Address);
	});
	it('should get L2 token address', async () => {
		const res = await web3.zkSync.getL2Address(EXAMPLE_ERC20_TOKEN.address);
		expect(res).toBe(EXAMPLE_ERC20_TOKEN.l2Address);
	});
});
