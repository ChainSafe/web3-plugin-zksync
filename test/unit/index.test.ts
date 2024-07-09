import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../../src';

describe('ZkSyncPlugin tests', () => {
	it('should register ZkSync plugin on Web3Context instance', () => {
		const web3 = new Web3('http://some-rpc-url-l1.com');
		// @ts-ignore
		web3.registerPlugin(new ZkSyncPlugin('http://some-rpc-url-l2.com'));
		expect(web3.zkSync).toBeDefined();
	});
});
