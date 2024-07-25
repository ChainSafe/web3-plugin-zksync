import { SmartAccount, types, Web3ZkSyncL2 } from '../../src';
import {
	IS_ETH_BASED,
	PRIVATE_KEY1,
	ADDRESS3,
	APPROVAL_TOKEN,
	PAYMASTER,
	deepEqualExcluding,
	USDC_L1,
} from '../utils';

import { EIP712_TX_TYPE, ETH_ADDRESS } from '../../lib/constants';
import { toBigInt, toWei } from 'web3-utils';
import { getPaymasterParams } from '../../lib/paymaster-utils';
import { privateKeyToAccount } from '../../../web3.js/packages/web3-eth-accounts';
const PRIVATE_KEY = (process.env.PRIVATE_KEY as string) || PRIVATE_KEY1;
const mainAccount = privateKeyToAccount(PRIVATE_KEY);
jest.setTimeout(60000);
describe('SmartAccount', () => {
	const provider = Web3ZkSyncL2.initWithDefaultProvider(types.Network.Sepolia);
	// const ethProvider = new Web3ZkSyncL1(
	// 	'https://eth-sepolia.g.alchemy.com/v2/VCOFgnRGJF_vdAY2ZjgSksL6-6pYvRkz',
	// );
	// const wallet = new ZKSyncWallet(mainAccount.privateKey, provider, ethProvider);
	const account = new SmartAccount(
		{ address: mainAccount.address, secret: mainAccount.privateKey },
		provider,
	);

	describe('#constructor()', () => {
		it('`SmartAccount(address, {address, secret}, provider)` should return a `SmartAccount` with signer and provider', () => {
			const account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBe(provider);
		});

		it('`SmartAccount(address, {address, secret})` should return a `SmartAccount` with signer', () => {
			const account = new SmartAccount({
				address: mainAccount.address,
				secret: mainAccount.privateKey,
			});
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBeUndefined();
		});

		it('`SmartWallet(address, {address, secret, payloadSigner, transactionBuilder}, provider)` should return a `SmartAccount` with custom payload signing method', async () => {
			const account = new SmartAccount(
				{
					address: mainAccount.address,
					secret: mainAccount.privateKey,
					payloadSigner: () => {
						return '0x';
					},
					transactionBuilder: async () => {
						return {};
					},
				},
				provider,
			);

			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBe(provider);
		});
	});

	describe('#connect()', () => {
		it('should return a `SmartAccount` with provided `provider` as a provider', async () => {
			const newProvider = Web3ZkSyncL2.initWithDefaultProvider(types.Network.Mainnet);
			let account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			account = account.connect(newProvider);
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBe(newProvider);
		});

		it('should return a `SmartAccount` with no `provider` when `null` is used', async () => {
			let account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			account = account.connect(null);
			expect(account.address).toBe(mainAccount.address);
			expect(account.secret).toBe(mainAccount.privateKey);
			expect(account.provider).toBeUndefined();
		});
	});

	describe('#getAddress()', () => {
		it('should return the `SmartAccount` address', async () => {
			const account = new SmartAccount(
				{ address: mainAccount.address, secret: mainAccount.privateKey },
				provider,
			);
			const result = await account.getAddress();
			expect(result).toBe(mainAccount.address);
		});
	});

	describe('#getBalance()', () => {
		it('should return a `SmartAccount` balance', async () => {
			const result = await account.getBalance();
			expect(result > 0n).toBeTruthy();
		});
	});

	describe('#getAllBalances()', () => {
		it('should return all balances', async () => {
			const result = await account.getAllBalances();
			const expected = IS_ETH_BASED ? 2 : 3;
			expect(Object.keys(result)).toHaveLength(expected);
		});
	});

	describe('#getDeploymentNonce()', () => {
		it('should return the deployment nonce', async () => {
			const result = await account.getDeploymentNonce();
			expect(result).not.toBeNull();
		});
	});

	describe('#populateTransaction()', () => {
		it('should return a populated transaction', async () => {
			const tx = {
				to: ADDRESS3,
				value: 7_000_000_000n,
				type: toBigInt(EIP712_TX_TYPE),
				from: mainAccount.address,
				nonce: await account.getNonce('pending'),
				gasLimit: 156_726n,
				chainId: 300n,
				data: '0x',
				customData: { gasPerPubdata: 50_000, factoryDeps: [] },
				gasPrice: 100_000_000n,
			};

			const result = await account.populateTransaction({
				type: EIP712_TX_TYPE,
				to: ADDRESS3,
				value: 7_000_000_000,
			});
			deepEqualExcluding(result, tx, [
				'nonce',
				'gasPrice',
				'gasLimit',
				'maxFeePerGas',
				'maxPriorityFeePerGas',
			]);
			expect(toBigInt(result.gasLimit) > 0n).toBeTruthy();
		});

		it('should return a populated transaction with default values if are omitted', async () => {
			const tx = {
				to: ADDRESS3,
				value: 7_000_000n,
				type: toBigInt(EIP712_TX_TYPE),
				from: mainAccount.address,
				nonce: await account.getNonce('pending'),
				chainId: 300n,
				gasPrice: 100_000_000n,
				data: '0x',
				customData: { gasPerPubdata: 50_000, factoryDeps: [] },
			};
			const result = await account.populateTransaction({
				to: ADDRESS3,
				value: 7_000_000,
			});
			deepEqualExcluding(result, tx, [
				'nonce',
				'gasPrice',
				'gasLimit',
				'maxFeePerGas',
				'maxPriorityFeePerGas',
			]);
			expect(toBigInt(result.gasLimit) > 0n).toBeTruthy();
		});
	});

	describe('#signTransaction()', () => {
		it('should return a signed EIP712 transaction', async () => {
			const result = await account.signTransaction({
				to: ADDRESS3,
				value: toWei(1, 'wei'),
			});
			expect(result).not.toBeNull();
		});
	});

	describe('#signMessage()', () => {
		it('should return a signed message', async () => {
			const result = await account.signMessage('Hello World!');
			expect(result).toBe(
				'0xf8abe661ac744b659fbf4379e1f7bab32e673fe0d6028752e446ae2ce2eb96fb03353584c8a26f2f274ee64e659cf104e39f32989299c8dfe9034d01c03cd2741b',
			);
		});
	});

	describe('#signTypedData()', () => {
		it('should return a signed typed data', async () => {
			const result = await account.signTypedData(
				{ name: 'Example', version: '1', chainId: 300 },
				{
					Person: [
						{ name: 'name', type: 'string' },
						{ name: 'age', type: 'uint8' },
					],
				},
				{ name: 'John', age: 30 },
			);
			expect(result).toBe(
				'0xa7f26e6102572312b3f417d1ea5f7ea421a56d3a71d0892f7b8e9dc756f7820013fb398b446aad54ec5d06ed4504318ae22fe2c829491beb0db3a5c7cf1b8f781c',
			);
		});
	});

	describe('#transfer()', () => {
		it('should transfer ETH', async () => {
			const amount = 1_000_000_000n;
			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3);

			const tx = await account.transfer({
				token: ETH_ADDRESS,
				to: ADDRESS3,
				amount: amount,
			});
			expect(tx.hash).not.toBeNull();
			const receipt = await tx.wait();
			expect(receipt.transactionHash).not.toBeNull();
			const balanceAfterTransfer = await provider.getBalance(ADDRESS3);
			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
		});

		it.skip('should transfer ETH using paymaster to cover fee', async () => {
			const amount = 7_000_000_000n;
			const minimalAllowance = 1n;

			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceBeforeTransfer = await account.getBalance();
			const senderApprovalTokenBalanceBeforeTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getBalance(ADDRESS3);

			const tx = await account.transfer({
				token: ETH_ADDRESS,
				to: ADDRESS3,
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const result = await tx.wait();

			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceAfterTransfer = await account.getBalance();
			const senderApprovalTokenBalanceAfterTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getBalance(ADDRESS3);

			expect(
				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
			).toBeTruthy();
			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
				minimalAllowance,
			);

			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
			expect(
				senderApprovalTokenBalanceAfterTransfer ===
					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			).toBeTruthy();

			expect(result).not.toBeNull();
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
		});

		it('should transfer USDC', async () => {
			const amount = 5n;
			const l2USDC = await provider.l2TokenAddress(USDC_L1);
			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3, 'latest', l2USDC);
			const tx = await account.transfer({
				token: l2USDC,
				to: ADDRESS3,
				amount: amount,
			});
			const result = await tx.wait();
			const balanceAfterTransfer = await provider.getBalance(ADDRESS3, 'latest', l2USDC);
			expect(result).not.toBeNull();
			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
		});

		it.skip('should transfer USDC using paymaster to cover fee', async () => {
			const amount = 5n;
			const minimalAllowance = 1n;
			const l2USDC = await provider.l2TokenAddress(USDC_L1);

			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceBeforeTransfer = await account.getBalance(l2USDC);
			const senderApprovalTokenBalanceBeforeTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceBeforeTransfer = await provider.getBalance(
				ADDRESS3,
				'latest',
				l2USDC,
			);

			const tx = await account.transfer({
				token: l2USDC,
				to: ADDRESS3,
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const result = await tx.wait();

			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
				PAYMASTER,
				'latest',
				APPROVAL_TOKEN,
			);
			const senderBalanceAfterTransfer = await account.getBalance(l2USDC);
			const senderApprovalTokenBalanceAfterTransfer =
				await account.getBalance(APPROVAL_TOKEN);
			const receiverBalanceAfterTransfer = await provider.getBalance(
				ADDRESS3,
				'latest',
				l2USDC,
			);

			expect(
				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
			).toBeTruthy();
			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
				minimalAllowance,
			);

			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
			expect(
				senderApprovalTokenBalanceAfterTransfer ===
					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
			).toBeTruthy();

			expect(result).not.toBeNull();
			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
		});
	});

	describe('#withdraw()', () => {
		it('should withdraw ETH to the L1 network', async () => {
			const amount = 7_000_000_000n;
			// const l2BalanceBeforeWithdrawal = await account.getBalance();
			const withdrawTx = await account.withdraw({
				token: ETH_ADDRESS,
				to: await account.getAddress(),
				amount: amount,
			});
			const receipt = await withdrawTx.wait();
			expect(receipt.transactionHash).not.toBeNull();
			// await withdrawTx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
			// const l2BalanceAfterWithdrawal = await account.getBalance();
			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toBeTruthy();
		});

		it.skip('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
			const amount = 7_000_000_000n;
			const minimalAllowance = 1n;

			// const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceBeforeWithdrawal = await account.getBalance();
			// const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);

			const withdrawTx = await account.withdraw({
				token: ETH_ADDRESS,
				to: await account.getAddress(),
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const tx = await withdrawTx.wait();
			expect(tx.transactionHash).not.toBeNull();
			// await withdrawTx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();

			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);

			// const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceAfterWithdrawal = await account.getBalance();
			// const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);

			// expect(
			// 	paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
			// ).toBeTruthy();
			// expect(
			// 	paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
			// ).toBe(minimalAllowance);
			//
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			// expect(
			// 	l2ApprovalTokenBalanceAfterWithdrawal ===
			// 		l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
			// ).toBeTruthy();
			//
			// expect(result).not.toBeNull();
		});

		it('should withdraw USDC to the L1 network', async () => {
			const amount = 5n;
			const L2USDC = await provider.l2TokenAddress(USDC_L1);
			// const l2BalanceBeforeWithdrawal = await account.getBalance(L2USDC);
			// const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(USDC_L1);

			const withdrawTx = await account.withdraw({
				token: L2USDC,
				to: await account.getAddress(),
				amount: amount,
			});
			const tx = await withdrawTx.wait();
			expect(tx.transactionHash).not.toBeNull();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
			// const l2BalanceAfterWithdrawal = await account.getBalance(L2USDC);
			// const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
			//
			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			// expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
		});

		it.skip('should withdraw USDC to the L1 network using paymaster to cover fee', async () => {
			const amount = 5n;
			const minimalAllowance = 1n;
			const l2USDC = await provider.l2TokenAddress(USDC_L1);

			// const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceBeforeWithdrawal = await account.getBalance(l2USDC);
			// const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(USDC_L1);
			// const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);

			const withdrawTx = await account.withdraw({
				token: l2USDC,
				to: await account.getAddress(),
				amount: amount,
				paymasterParams: getPaymasterParams(PAYMASTER, {
					type: 'ApprovalBased',
					token: APPROVAL_TOKEN,
					minimalAllowance: minimalAllowance,
					innerInput: new Uint8Array(),
				}),
			});
			const tx = await withdrawTx.wait();
			expect(tx.transactionHash).not.toBeNull();
			// await withdrawTx.waitFinalize();
			// expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
			//
			// const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
			//
			// const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
			// const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
			// 	PAYMASTER,
			// 	'latest',
			// 	APPROVAL_TOKEN,
			// );
			// const l2BalanceAfterWithdrawal = await account.getBalance(l2USDC);
			// const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(USDC_L1);
			// const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);
			//
			// expect(
			// 	paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
			// ).toBeTruthy();
			// expect(
			// 	paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
			// ).toBe(minimalAllowance);
			// expect(
			// 	l2ApprovalTokenBalanceAfterWithdrawal ===
			// 		l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
			// ).toBeTruthy();
			//
			// expect(result).not.toBeNull();
			// expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
			// expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
		});
	});
});

// describe('MultisigECDSASmartAccount', () => {
// 	const provider = Web3ZkSyncL2.initWithDefaultProvider(types.Network.Sepolia);
// 	const ethProvider = new Web3ZkSyncL1(
// 		'https://eth-sepolia.g.alchemy.com/v2/VCOFgnRGJF_vdAY2ZjgSksL6-6pYvRkz',
// 	);
// 	const wallet = new ZKSyncWallet(mainAccount.privateKey, provider, ethProvider);
// 	let account: SmartAccount;
//
// 	// beforeAll(async function () {
// 	// 	const deployer = ECDSASmartAccount.create(mainAccount.address, mainAccount.privateKey, provider);
// 	//
// 	// 	const multisigAccountAbi = MultisigAccount.abi;
// 	// 	const multisigAccountBytecode: string = MultisigAccount.bytecode;
// 	// 	const factory = new provider.eth.Contract(multisigAccountAbi);
// 	// 	const deploed = await factory
// 	// 		.deploy({
// 	// 			data: multisigAccountBytecode,
// 	// 		})
// 	// 		.send({
// 	// 			from: deployer.address,
// 	// 		});
// 	// 	deploed.methods.createAccount();
// 	// 	const owner1 = new ZKSyncWallet(mainAccount.privateKey);
// 	// 	const owner2 = new ZKSyncWallet(PRIVATE_KEY2);
// 	// 	const multisigContract = await factory.deploy(owner1.address, owner2.address);
// 	// 	const multisigAddress = await multisigContract.methods.getAddress();
// 	//
// 	// 	// send ETH to multisig account
// 	// 	await (
// 	// 		await deployer.sendTransaction({
// 	// 			to: multisigAddress,
// 	// 			value: toWei(1, 'ether'),
// 	// 		})
// 	// 	).wait();
// 	//
// 	// 	// send paymaster approval token to multisig account
// 	// 	const sendApprovalTokenTx = await deployer.transfer({
// 	// 		to: multisigAddress,
// 	// 		token: APPROVAL_TOKEN,
// 	// 		amount: 5,
// 	// 	});
// 	// 	await sendApprovalTokenTx.wait();
// 	//
// 	// 	// send DAI token to multisig account
// 	// 	const sendTokenTx = await deployer.transfer({
// 	// 		to: multisigAddress,
// 	// 		token: await provider.l2TokenAddress(DAI_L1),
// 	// 		amount: 20,
// 	// 	});
// 	// 	await sendTokenTx.wait();
// 	//
// 	// 	account = MultisigECDSASmartAccount.create(
// 	// 		multisigAddress,
// 	// 		[mainAccount.privateKey, PRIVATE_KEY2],
// 	// 		provider,
// 	// 	);
// 	// });
//
// 	describe('#transfer()', () => {
// 		it('should transfer ETH', async () => {
// 			const amount = 7_000_000_000n;
// 			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3);
// 			const tx = await account.transfer({
// 				token: ETH_ADDRESS,
// 				to: ADDRESS3,
// 				amount: amount,
// 			});
// 			const result = await tx.wait();
// 			const balanceAfterTransfer = await provider.getBalance(ADDRESS3);
// 			expect(result).not.toBeNull();
// 			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
// 		});
//
// 		it('should transfer ETH using paymaster to cover fee', async () => {
// 			const amount = 7_000_000_000n;
// 			const minimalAllowance = 1n;
//
// 			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceBeforeTransfer = await account.getBalance();
// 			const senderApprovalTokenBalanceBeforeTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceBeforeTransfer = await provider.getBalance(ADDRESS3);
//
// 			const tx = await account.transfer({
// 				token: ETH_ADDRESS,
// 				to: ADDRESS3,
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			const result = await tx.wait();
//
// 			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceAfterTransfer = await account.getBalance();
// 			const senderApprovalTokenBalanceAfterTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceAfterTransfer = await provider.getBalance(ADDRESS3);
//
// 			expect(
// 				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
// 			).toBeTruthy();
// 			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
// 				minimalAllowance,
// 			);
//
// 			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
// 			expect(
// 				senderApprovalTokenBalanceAfterTransfer ===
// 					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
// 		});
//
// 		it('should transfer DAI', async () => {
// 			const amount = 5n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
// 			const balanceBeforeTransfer = await provider.getBalance(ADDRESS3, 'latest', l2DAI);
// 			const tx = await account.transfer({
// 				token: l2DAI,
// 				to: ADDRESS3,
// 				amount: amount,
// 			});
// 			const result = await tx.wait();
// 			const balanceAfterTransfer = await provider.getBalance(ADDRESS3, 'latest', l2DAI);
// 			expect(result).not.toBeNull();
// 			expect(balanceAfterTransfer - balanceBeforeTransfer).toBe(amount);
// 		});
//
// 		it('should transfer DAI using paymaster to cover fee', async () => {
// 			const amount = 5n;
// 			const minimalAllowance = 1n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
//
// 			const paymasterBalanceBeforeTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceBeforeTransfer = await account.getBalance(l2DAI);
// 			const senderApprovalTokenBalanceBeforeTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceBeforeTransfer = await provider.getBalance(
// 				ADDRESS3,
// 				'latest',
// 				l2DAI,
// 			);
//
// 			const tx = await account.transfer({
// 				token: l2DAI,
// 				to: ADDRESS3,
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			const result = await tx.wait();
//
// 			const paymasterBalanceAfterTransfer = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterTransfer = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const senderBalanceAfterTransfer = await account.getBalance(l2DAI);
// 			const senderApprovalTokenBalanceAfterTransfer =
// 				await account.getBalance(APPROVAL_TOKEN);
// 			const receiverBalanceAfterTransfer = await provider.getBalance(
// 				ADDRESS3,
// 				'latest',
// 				l2DAI,
// 			);
//
// 			expect(
// 				paymasterBalanceBeforeTransfer - paymasterBalanceAfterTransfer >= 0n,
// 			).toBeTruthy();
// 			expect(paymasterTokenBalanceAfterTransfer - paymasterTokenBalanceBeforeTransfer).toBe(
// 				minimalAllowance,
// 			);
//
// 			expect(senderBalanceBeforeTransfer - senderBalanceAfterTransfer).toBe(amount);
// 			expect(
// 				senderApprovalTokenBalanceAfterTransfer ===
// 					senderApprovalTokenBalanceBeforeTransfer - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 			expect(receiverBalanceAfterTransfer - receiverBalanceBeforeTransfer).toBe(amount);
// 		});
// 	});
//
// 	describe('#withdraw()', () => {
// 		it('should withdraw ETH to the L1 network', async () => {
// 			const amount = 7_000_000_000n;
// 			const l2BalanceBeforeWithdrawal = await account.getBalance();
// 			const withdrawTx = await account.withdraw({
// 				token: ETH_ADDRESS,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
// 			const l2BalanceAfterWithdrawal = await account.getBalance();
// 			expect(result).not.toBeNull();
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal >= amount).toBeTruthy();
// 		});
//
// 		it('should withdraw ETH to the L1 network using paymaster to cover fee', async () => {
// 			const amount = 7_000_000_000n;
// 			const minimalAllowance = 1n;
//
// 			const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceBeforeWithdrawal = await account.getBalance();
// 			const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			const withdrawTx = await account.withdraw({
// 				token: ETH_ADDRESS,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
//
// 			const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceAfterWithdrawal = await account.getBalance();
// 			const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			expect(
// 				paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0,
// 			).toBeTruthy();
// 			expect(
// 				paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
// 			).toBe(minimalAllowance);
//
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
// 			expect(
// 				l2ApprovalTokenBalanceAfterWithdrawal ===
// 					l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 		});
//
// 		it('should withdraw DAI to the L1 network', async () => {
// 			const amount = 5n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
// 			const l2BalanceBeforeWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(DAI_L1);
//
// 			const withdrawTx = await account.withdraw({
// 				token: l2DAI,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
//
// 			const l2BalanceAfterWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
//
// 			expect(result).not.toBeNull();
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
// 			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
// 		});
//
// 		it('should withdraw DAI to the L1 network using paymaster to cover fee', async () => {
// 			const amount = 5n;
// 			const minimalAllowance = 1n;
// 			const l2DAI = await provider.l2TokenAddress(DAI_L1);
//
// 			const paymasterBalanceBeforeWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceBeforeWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceBeforeWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceBeforeWithdrawal = await wallet.getBalanceL1(DAI_L1);
// 			const l2ApprovalTokenBalanceBeforeWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			const withdrawTx = await account.withdraw({
// 				token: l2DAI,
// 				to: await wallet.getAddress(), // send to L1 EOA since AA does not exit on L1
// 				amount: amount,
// 				paymasterParams: getPaymasterParams(PAYMASTER, {
// 					type: 'ApprovalBased',
// 					token: APPROVAL_TOKEN,
// 					minimalAllowance: minimalAllowance,
// 					innerInput: new Uint8Array(),
// 				}),
// 			});
// 			await withdrawTx.waitFinalize();
// 			expect(await wallet.isWithdrawalFinalized(withdrawTx.hash)).toBeFalsy();
//
// 			const result = await wallet.finalizeWithdrawal(withdrawTx.hash);
//
// 			const paymasterBalanceAfterWithdrawal = await provider.getBalance(PAYMASTER);
// 			const paymasterTokenBalanceAfterWithdrawal = await provider.getBalance(
// 				PAYMASTER,
// 				'latest',
// 				APPROVAL_TOKEN,
// 			);
// 			const l2BalanceAfterWithdrawal = await account.getBalance(l2DAI);
// 			const l1BalanceAfterWithdrawal = await wallet.getBalanceL1(DAI_L1);
// 			const l2ApprovalTokenBalanceAfterWithdrawal = await account.getBalance(APPROVAL_TOKEN);
//
// 			expect(
// 				paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
// 			).toBeTruthy();
// 			expect(
// 				paymasterTokenBalanceAfterWithdrawal - paymasterTokenBalanceBeforeWithdrawal,
// 			).toBe(minimalAllowance);
// 			expect(
// 				l2ApprovalTokenBalanceAfterWithdrawal ===
// 					l2ApprovalTokenBalanceBeforeWithdrawal - minimalAllowance,
// 			).toBeTruthy();
//
// 			expect(result).not.toBeNull();
// 			expect(l2BalanceBeforeWithdrawal - l2BalanceAfterWithdrawal).toBe(amount);
// 			expect(l1BalanceAfterWithdrawal - l1BalanceBeforeWithdrawal).toBe(amount);
// 		});
// 	});
// });
