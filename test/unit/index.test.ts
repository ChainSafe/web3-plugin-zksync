import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../../src';

describe('ZkSyncPlugin tests', () => {
	it('should register ZkSync plugin on Web3Context instance', () => {
		const web3 = new Web3('https://sepolia.era.zksync.dev');
		// @ts-ignore
		web3.registerPlugin(new ZkSyncPlugin('https://sepolia.era.zksync.dev'));
		expect(web3.zkSync).toBeDefined();
	});
});
