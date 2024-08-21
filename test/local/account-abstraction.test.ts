import { Web3ZKsyncL2, ZKsyncWallet } from '../../src';
import { ECDSASmartAccount, MultisigECDSASmartAccount, constants } from '../../src';
import { toWei } from 'web3-utils';
import Storage from './files/Storage.json';
import Token from './files/Token.json';
import Paymaster from './files/Paymaster.json';
import MultisigAccount from './files/TwoUserMultisig.json';
import { getAccounts, L2Provider, PAYMASTER, APPROVAL_TOKEN } from './fixtures';
import { getPaymasterParams, ContractFactory } from '../../src';
import { Address } from 'web3';
import { Eip712TxData } from '../../src/types';
import { Transaction } from 'web3-types';
const { ETH_ADDRESS } = constants;
const accounts = getAccounts();

jest.setTimeout(300000);
describe('Account Abstraction', () => {
	const l2Provider = new Web3ZKsyncL2(L2Provider);
	const PRIVATE_KEY1 = accounts[0].privateKey;
	const ADDRESS1 = accounts[0].address;
	const wallet = new ZKsyncWallet(PRIVATE_KEY1, l2Provider);
	const acc = l2Provider.eth.accounts.privateKeyToAccount(PRIVATE_KEY1);
	l2Provider.eth.accounts.wallet.add(acc);
	it('use the ERC20 token for paying transaction fee', async () => {
		const InitMintAmount = 10n;
		const mintAmount = 3n;
		const minimalAllowance = 1n;

		const abi = Token.abi;
		const bytecode: string = Token.bytecode;
		const factory = new ContractFactory(abi, bytecode, wallet);
		const tokenContract = await factory.deploy(['Ducat', 'Ducat', 18]);
		const tokenAddress = tokenContract.options.address as Address;

		// mint tokens to wallet, so it could pay fee with tokens
		await tokenContract.methods
			.mint(wallet.getAddress(), InitMintAmount)
			.send({ from: wallet.getAddress() });

		const paymasterAbi = Paymaster.abi;
		const paymasterBytecode = Paymaster.bytecode;
		const accountFactory = new ContractFactory(
			paymasterAbi,
			paymasterBytecode,
			wallet,
			'createAccount',
		);
		const paymasterContract = await accountFactory.deploy([tokenAddress]);
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
		const tx = tokenContract.methods
			.mint(await wallet.getAddress(), mintAmount)
			.populateTransaction({ from: wallet.getAddress() }) as Eip712TxData;
		tx.customData = {
			gasPerPubdata: constants.DEFAULT_GAS_PER_PUBDATA_LIMIT,
			paymasterParams: getPaymasterParams(paymasterAddress, {
				type: 'ApprovalBased',
				token: tokenAddress,
				minimalAllowance: minimalAllowance,
				innerInput: new Uint8Array(),
			}),
		};

		const mintTx = await wallet.sendTransaction(tx as Transaction);
		await mintTx.wait();
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
		expect(paymasterTokenBalanceAfterTx).toBe(minimalAllowance);

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

		const factory = new ContractFactory(
			multisigAccountAbi,
			multisigAccountBytecode,
			wallet,
			'create',
		);
		const owner1 = new ZKsyncWallet(
			'0x63bbd75f81a3b889bf4faf581162dfe52bbd09d0149f4987d9a8cb654684441c',
			new Web3ZKsyncL2(L2Provider),
		);
		await (
			await wallet.transfer({
				to: owner1.address,
				amount: 1000_000000_000000n,
			})
		).wait();
		const owner2 = new ZKsyncWallet(
			'0x2553cbc2c37248d0058a736f79ce1dac13e24dbecb0d371df6f4f53fa97ef789',
			new Web3ZKsyncL2(L2Provider),
		);
		const args = [owner1.getAddress(), owner2.getAddress()];
		const multisigContract = await factory.deploy(args);

		const multisigAddress = multisigContract.options.address as Address;
		// send ETH to multisig account
		const refillTx = await account.sendTransaction({
			to: multisigAddress, //,
			value: 1_000000_000000_000000n,
		});
		await account.getBalance();
		await refillTx.wait();
		// send paymaster approval token to multisig account
		const sendApprovalTokenTx = await wallet.transfer({
			to: multisigAddress,
			token: APPROVAL_TOKEN,
			amount: 5,
		});
		await sendApprovalTokenTx.wait();

		const multisigAccount = MultisigECDSASmartAccount.create(
			multisigAddress,
			[owner1.account.privateKey, owner2.account.privateKey],
			l2Provider,
		);

		// deploy storage account which will be called from multisig account
		const storageAbi = Storage.contracts['Storage.sol:Storage'].abi;
		const storageBytecode: string = Storage.contracts['Storage.sol:Storage'].bin;

		const storageFactory = new ContractFactory(storageAbi, storageBytecode, wallet);
		const storage = await storageFactory.deploy();

		const multisigAccountBalanceBeforeTx = await multisigAccount.getBalance();

		// const storageSetTx = await storage.methods
		// 	.set(storageValue)
		// 	.populateTransaction({ from: multisigAddress });

		const random = ZKsyncWallet.createRandom(l2Provider);
		const beforeB = await random.getBalance();
		console.log('multisigAccountBalanceBeforeTx', multisigAccountBalanceBeforeTx);
		console.log('beforeB', beforeB);
		const transferTx = await multisigAccount.transfer({
			to: random.getAddress(),
			amount: 100n,
		});
		await transferTx.wait();
		const beforeA = await random.getBalance();
		console.log('beforeA', beforeA);

		// const tx = await multisigAccount.sendTransaction({ ...storageSetTx });
		// await tx.wait();
		//
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
