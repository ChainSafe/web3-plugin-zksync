import { Web3 } from 'web3';
import { ZkSyncPlugin } from '../src';

describe('ZkSyncPlugin tests', () => {
	it('should register ZkSync plugin on Web3Context instance', () => {
		const web3 = new Web3('http://127.0.0.1:8545');
		web3.registerPlugin(new ZkSyncPlugin());
		expect(web3.zkSync).toBeDefined();
	});
});
