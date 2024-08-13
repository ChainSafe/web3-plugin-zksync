import { Web3ZKsyncL2, ZKsyncWallet } from '../../src';
import { ECDSASmartAccount, MultisigECDSASmartAccount, constants } from '../../src';
import { toWei } from 'web3-utils';

import Storage from './files/Storage.json';
import Token from './files/Token.json';
import Paymaster from './files/Paymaster.json';
import MultisigAccount from './files/TwoUserMultisig.json';
import { getAccounts, L2Provider, PAYMASTER, APPROVAL_TOKEN } from './fixtures';
import { getPaymasterParams } from '../../src';
import { Address } from 'web3';
import { DEFAULT_GAS_PER_PUBDATA_LIMIT } from '../../lib/constants';
const { ETH_ADDRESS } = constants;
const accounts = getAccounts();
describe('Account Abstraction', () => {
	const l2Provider = new Web3ZKsyncL2(L2Provider);
	const PRIVATE_KEY1 = accounts[0].privateKey;
	const ADDRESS1 = accounts[0].address;
	const wallet = new ZKsyncWallet(PRIVATE_KEY1, l2Provider);
	const acc = l2Provider.eth.accounts.privateKeyToAccount(PRIVATE_KEY1);
	l2Provider.eth.accounts.wallet.add(acc);
	it.skip('use the ERC20 token for paying transaction fee', async () => {
		const InitMintAmount = 10n;
		const mintAmount = 3n;
		const minimalAllowance = 1n;

		const abi = Token.abi;
		const bytecode: string = Token.bytecode;
		const contr = new l2Provider.eth.Contract(abi);
		const tokenContract = await contr
			.deploy({ data: bytecode, arguments: ['Ducat', 'Ducat', 18] })
			.send({ from: ADDRESS1 });
		const tokenAddress = tokenContract.options.address as Address;

		// mint tokens to wallet, so it could pay fee with tokens
		await tokenContract.methods
			.mint(wallet.getAddress(), InitMintAmount)
			.send({ from: ADDRESS1 });

		const paymasterAbi = Paymaster.abi;
		const paymasterBytecode = Paymaster.bytecode;
		const accountFactory = new l2Provider.eth.Contract(paymasterAbi);
		const paymasterContract = await accountFactory
			.deploy({ data: paymasterBytecode, arguments: [tokenAddress] })
			.send({ from: ADDRESS1 });
		const paymasterAddress = paymasterContract.options.address as Address;

		// transfer ETH to paymaster so it could pay fee
		const faucetTx = await wallet.transfer({
			token: ETH_ADDRESS,
			to: paymasterAddress,
			amount: toWei(0.01, 'ether'),
		});
		await faucetTx.wait();

		const paymasterBalanceBeforeTx = await l2Provider.getBalance(paymasterAddress);
		const paymasterTokenBalanceBeforeTx = await l2Provider.getBalance(
			paymasterAddress,
			'latest',
			tokenAddress,
		);
		const walletBalanceBeforeTx = await wallet.getBalance();
		const walletTokenBalanceBeforeTx = await wallet.getBalance(tokenAddress);

		// perform tx using paymaster
		await tokenContract.methods
			.mint(await wallet.getAddress(), mintAmount, {
				customData: {
					gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
					paymasterParams: getPaymasterParams(paymasterAddress, {
						type: 'ApprovalBased',
						token: tokenAddress,
						minimalAllowance: minimalAllowance,
						innerInput: new Uint8Array(),
					}),
				},
			})
			.send({ from: ADDRESS1 });

		const paymasterBalanceAfterTx = await l2Provider.getBalance(paymasterAddress);
		const paymasterTokenBalanceAfterTx = await l2Provider.getBalance(
			paymasterAddress,
			'latest',
			tokenAddress,
		);
		const walletBalanceAfterTx = await wallet.getBalance();
		const walletTokenBalanceAfterTx = await wallet.getBalance(tokenAddress);

		expect(paymasterTokenBalanceBeforeTx === 0n).toBeTruthy();
		expect(walletTokenBalanceBeforeTx === InitMintAmount).toBeTruthy();

		expect(paymasterBalanceBeforeTx - paymasterBalanceAfterTx >= 0n).toBeTruthy();
		expect(paymasterTokenBalanceAfterTx === minimalAllowance).toBeTruthy();

		expect(walletBalanceBeforeTx - walletBalanceAfterTx >= 0n).toBeTruthy();
		expect(
			walletTokenBalanceAfterTx ===
				walletTokenBalanceBeforeTx - minimalAllowance + mintAmount,
		).toBeTruthy();
	});

	it.skip('use multisig account', async () => {
		const storageValue = 500n;

		const account = ECDSASmartAccount.create(ADDRESS1, PRIVATE_KEY1, l2Provider);

		const multisigAccountAbi = MultisigAccount.abi;
		const multisigAccountBytecode: string = MultisigAccount.bytecode;
		const factoryMultisigContract = new l2Provider.eth.Contract(multisigAccountAbi);
		const owner1 = ZKsyncWallet.createRandom();
		const owner2 = ZKsyncWallet.createRandom();
		const multisigContract = await factoryMultisigContract
			.deploy({
				data: multisigAccountBytecode,
				arguments: [owner1.address, owner2.address],
			})
			.send({ from: ADDRESS1 });
		const multisigAddress = multisigContract.options.address as Address;
		// send ETH to multisig account

		await (
			await account.sendTransaction({
				to: multisigAddress,
				value: toWei(1, 'ether'),
			})
		).wait();

		// send paymaster approval token to multisig account
		const sendApprovalTokenTx = await new ZKsyncWallet(PRIVATE_KEY1, l2Provider).transfer({
			to: multisigAddress,
			token: APPROVAL_TOKEN,
			amount: 5,
		});
		await sendApprovalTokenTx.wait();

		const multisigAccount = MultisigECDSASmartAccount.create(
			multisigAddress,
			[owner1.signingKey, owner2.signingKey],
			l2Provider,
		);

		// deploy storage account which will be called from multisig account
		const storageAbi = Storage.contracts['Storage.sol:Storage'].abi;
		const storageBytecode: string = Storage.contracts['Storage.sol:Storage'].bin;

		const storageFactory = new l2Provider.eth.Contract(storageAbi);
		const storage = await storageFactory
			.deploy({
				data: storageBytecode,
			})
			.send({ from: ADDRESS1 });

		const multisigAccountBalanceBeforeTx = await multisigAccount.getBalance();

		const storageSetTx = await storage.methods.set(storageValue).populateTransaction();
		const tx = await multisigAccount.sendTransaction({ ...storageSetTx });
		await tx.wait();

		const multisigAccountBalanceAfterTx = await multisigAccount.getBalance();
		expect(multisigAccountBalanceBeforeTx > multisigAccountBalanceAfterTx).toBeTruthy();
		expect(await storage.methods.get().call()).toBe(storageValue);
	});

	it.skip('use a contract with smart account as a runner to send transactions that utilize a paymaster', async () => {
		const minimalAllowance = 1n;
		const storageValue = 700n;

		const account = ECDSASmartAccount.create(ADDRESS1, PRIVATE_KEY1, l2Provider);

		const storageAbi = Storage.contracts['Storage.sol:Storage'].abi;
		const storageBytecode: string = Storage.contracts['Storage.sol:Storage'].bin;
		const storageFactory = new l2Provider.eth.Contract(storageAbi);
		const storage = await storageFactory
			.deploy({
				data: storageBytecode,
			})
			.send({ from: ADDRESS1 });

		const accountBalanceBeforeTx = await account.getBalance();
		const accountApprovalTokenBalanceBeforeTx = await account.getBalance(APPROVAL_TOKEN);

		const paymasterSetTx = await account.sendTransaction({
			...(await storage.methods.set(storageValue).populateTransaction()),
			// @ts-ignore
			customData: {
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			},
		});
		await paymasterSetTx.wait();

		const accountBalanceAfterTx = await account.getBalance();
		const accountApprovalTokenBalanceAfterTx = await account.getBalance(APPROVAL_TOKEN);

		expect(accountBalanceBeforeTx === accountBalanceAfterTx).toBeTruthy();
		expect(
			accountApprovalTokenBalanceAfterTx ===
				accountApprovalTokenBalanceBeforeTx - minimalAllowance,
		).toBeTruthy();
		expect(await storage.methods.get()).toBe(storageValue);
	});
});
