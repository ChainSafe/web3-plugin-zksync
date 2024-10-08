import { ZKsyncWallet, ContractFactory, Web3ZKsyncL2, Web3ZKsyncL1 } from '../src';

import Token from './files/Token.json';
import TokenL1 from './files/TokenL1.json';
import Paymaster from './files/Paymaster.json';
import { L1_CHAIN_URL, L2_CHAIN_URL } from './utils';
import { ETH_ADDRESS_IN_CONTRACTS } from '../src/constants';
import * as web3Utils from 'web3-utils';
import { Contract } from 'web3-eth-contract';

const PRIVATE_KEY = '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';

const provider = new Web3ZKsyncL2(L2_CHAIN_URL);
const ethProvider = new Web3ZKsyncL1(L1_CHAIN_URL);
const wallet = new ZKsyncWallet(PRIVATE_KEY, provider, ethProvider);

const DAI_L1 = '0x70a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55';

const SALT = '0x293328ad84b118194c65a0dc0defdb6483740d3163fd99b260907e15f2e2f642';
const TOKEN = '0x841c43Fa5d8fFfdB9efE3358906f7578d8700Dd4'; // deployed by using create2 and SALT
const PAYMASTER = '0xa222f0c183AFA73a8Bc1AFb48D34C88c9Bf7A174'; // approval based paymaster for TOKEN deployed by using create2 and SALT

// needed for some console.log
(BigInt.prototype as any).toJSON = function () {
	return this.toString();
};

// Deploys token and approval based paymaster for that token using create2 method.
// Mints tokens to wallet and sends ETH to paymaster.
async function deployPaymasterAndToken(): Promise<{
	token: string;
	paymaster: string;
}> {
	const abi = Token.abi;
	const bytecode: string = Token.bytecode;
	const factory = new ContractFactory(abi, bytecode, wallet, 'create2');
	const tokenContract = await factory.deploy(['Crown', 'Crown', 18], {
		customData: { salt: SALT },
	});
	const tokenAddress = (await tokenContract.options.address) as string;

	// mint tokens to wallet
	const mintTx = await tokenContract.methods.mint(await wallet.getAddress(), 50);
	await mintTx.send();

	const paymasterAbi = Paymaster.abi;
	const paymasterBytecode = Paymaster.bytecode;

	const accountFactory = new ContractFactory(
		paymasterAbi,
		paymasterBytecode,
		wallet,
		'create2Account',
	);

	const paymasterContract = await accountFactory.deploy([tokenAddress], {
		customData: { salt: SALT },
	});
	const paymasterAddress = (await paymasterContract.options.address) as string;

	// transfer base token to paymaster so it could pay fee
	const faucetTx = await wallet.transfer({
		to: paymasterAddress,
		amount: web3Utils.toWei('100', 'ether'),
	});
	await faucetTx.wait();

	if (web3Utils.toChecksumAddress(TOKEN) !== web3Utils.toChecksumAddress(tokenAddress)) {
		throw new Error('token addresses mismatch');
	}

	if (web3Utils.toChecksumAddress(PAYMASTER) !== web3Utils.toChecksumAddress(paymasterAddress)) {
		throw new Error('paymaster addresses mismatch');
	}

	return { token: tokenAddress, paymaster: paymasterAddress };
}

/*
Mints tokens on L1 in case L2 is non-ETH based chain.
It mints based token, provided alternative tokens (different from base token) and wETH.
*/
async function mintTokensOnL1(l1Token: string) {
	if (l1Token !== ETH_ADDRESS_IN_CONTRACTS) {
		const token = new Contract(TokenL1.abi, l1Token, ethProvider);
		const mintTx = await token.methods.mint(
			await wallet.getAddress(),
			web3Utils.toWei('20000', 'ether'),
		);
		await mintTx.send({ from: await wallet.getAddress() });
	}
}

/*
Send base token to L2 in case L2 in non-ETH base chain.
*/
async function sendTokenToL2(l1TokenAddress: string) {
	const priorityOpResponse = await wallet.deposit({
		token: l1TokenAddress,
		to: await wallet.getAddress(),
		amount: web3Utils.toWei('10000', 'ether'),
		approveERC20: true,
		approveBaseERC20: true,
		refundRecipient: await wallet.getAddress(),
	});
	const receipt = await priorityOpResponse.waitFinalize();
	console.log(`Send funds tx: ${receipt.transactionHash}`);
}

async function main() {
	console.log('===== Minting and sending base token =====');
	const baseToken = await wallet.getBaseToken();
	console.log(`Wallet address: ${await wallet.getAddress()}`);
	console.log(`Base token L1: ${baseToken}`);

	console.log(`L1 base token balance before: ${await wallet.getBalanceL1(baseToken)}`);
	console.log(`L2 base token balance before: ${await wallet.getBalance()}`);

	await mintTokensOnL1(baseToken);
	await sendTokenToL2(baseToken);

	console.log(`L1 base token balance after: ${await wallet.getBalanceL1(baseToken)}`);
	console.log(`L2 base token balance after: ${await wallet.getBalance()} \n`);

	if (baseToken !== ETH_ADDRESS_IN_CONTRACTS) {
		console.log('===== No Eth based network so: Minting and sending ETH =====');

		const l2EthAddress = await wallet.l2TokenAddress(ETH_ADDRESS_IN_CONTRACTS);
		console.log(`ETH L1: ${ETH_ADDRESS_IN_CONTRACTS}`);
		console.log(`ETH L2: ${l2EthAddress}`);

		console.log(`L1 ETH balance before: ${await wallet.getBalanceL1()}`);
		console.log(`L2 ETH balance before: ${await wallet.getBalance(l2EthAddress)}`);

		await mintTokensOnL1(ETH_ADDRESS_IN_CONTRACTS);
		console.log(`Minted ETH on L1 successfully. Now sending the token to L2...`);
		await sendTokenToL2(ETH_ADDRESS_IN_CONTRACTS);

		console.log(`L1 ETH balance after: ${await wallet.getBalanceL1()}`);
		console.log(`L2 ETH balance after: ${await wallet.getBalance(l2EthAddress)}\n`);
	}

	console.log('===== Minting and sending DAI =====');

	const l2DAIAddress = await wallet.l2TokenAddress(DAI_L1);
	console.log(`DAI L1: ${DAI_L1}`);
	console.log(`DAI L2: ${l2DAIAddress}`);

	console.log(`L1 DAI balance before: ${await wallet.getBalanceL1(DAI_L1)}`);
	console.log(`L2 DAI balance before: ${await wallet.getBalance(l2DAIAddress)}`);

	await mintTokensOnL1(DAI_L1);
	console.log(`Minted DAI on L1 successfully. Now sending the DAI token to L2...`);
	await sendTokenToL2(DAI_L1);

	console.log(`L1 DAI balance after: ${await wallet.getBalanceL1(DAI_L1)}`);
	console.log(`L2 DAI balance after: ${await wallet.getBalance(l2DAIAddress)}`);

	console.log('===== Deploying token and paymaster =====');
	const { token, paymaster } = await deployPaymasterAndToken();
	console.log(`Token: ${token}`);
	console.log(`Paymaster: ${paymaster}`);
	console.log(`Paymaster ETH balance: ${await provider.getBalance(paymaster)}`);
	console.log(`Wallet Crown balance: ${await wallet.getBalance(token)}`);
}

main()
	.then()
	.catch(error => {
		console.log(`Error: ${error}`);
		console.warn(error.stack);
		console.warn(
			'Test Setup is verified with node 18. If you use nvm, you can execute this before running the script: `nvm use 18`.',
		);
	});
