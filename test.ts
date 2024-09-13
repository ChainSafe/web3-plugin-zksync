import { Web3 } from 'web3';
import { ZKsyncPlugin } from './src';

const web3 = new Web3();
web3.registerPlugin(new ZKsyncPlugin('https://mainnet.era.zksync.io'));
