import { core } from 'web3';
import { ZkSyncPlugin } from '../src';

describe('ZkSyncPlugin tests', () => {
	it('should register ZkSync plugin on Web3Context instance', () => {
		const web3Context = new core.Web3Context('http://127.0.0.1:8545');
		web3Context.registerPlugin(new ZkSyncPlugin());
		expect(web3Context.zkSync).toBeDefined();
	});
});
