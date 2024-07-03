import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../../src';

describe('ZkSyncPlugin tests', () => {
	it('should register ZkSync plugin on Web3Context instance', () => {
		const web3 = new Web3('http://some-rpc-url.com');
		web3.registerPlugin(new ZkSyncPlugin('http://some-l2-rpc-url.com'));
		expect(web3.zkSync).toBeDefined();
	});
});
