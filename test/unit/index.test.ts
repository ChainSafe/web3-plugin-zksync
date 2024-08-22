import { Web3 } from 'web3';
import { ZKsyncPlugin } from '../../src';

describe('ZkSyncPlugin tests', () => {
	it('should register ZkSync plugin on Web3Context instance', () => {
		const web3 = new Web3('https://sepolia.era.zksync.dev');
		web3.registerPlugin(new ZKsyncPlugin('https://sepolia.era.zksync.dev'));
		expect(web3.ZKsync).toBeDefined();
	});
});
