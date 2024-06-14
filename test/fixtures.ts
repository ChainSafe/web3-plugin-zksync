import type { Address, HexString } from 'web3';
import type { StorageProof } from '../src/types';

export const getRawBlockTransactionsData = {
	input: 251491,
	output: [
		{
			common_data: {
				L2: {
					nonce: BigInt(26736),
					fee: {
						gas_limit: BigInt(4000000),
						max_fee_per_gas: BigInt(1000000000),
						max_priority_fee_per_gas: BigInt(1000000000),
						gas_per_pubdata_limit: BigInt(20000),
					},
					initiatorAddress: '0x202bd724d72fd5a169c8930203e1b60870e4df95',
					signature: [
						137, 115, 161, 220, 2, 48, 185, 157, 125, 236, 198, 85, 99, 212, 128, 24,
						126, 171, 22, 34, 146, 36, 193, 208, 83, 3, 134, 11, 74, 38, 89, 252, 37,
						222, 4, 59, 169, 237, 144, 64, 12, 82, 61, 251, 40, 85, 42, 89, 21, 199, 71,
						128, 151, 231, 166, 230, 60, 14, 17, 59, 67, 118, 175, 216, 28,
					],
					transactionType: 'LegacyTransaction',
					input: {
						hash: '0x16d5e37b848eed8b33d927b7c3b9d974cc48e164af5f7a6d172334a1330a5e76',
						data: [
							249, 2, 206, 130, 104, 112, 132, 59, 154, 202, 0, 131, 61, 9, 0, 148,
							187, 92, 48, 154, 58, 147, 71, 192, 19, 91, 147, 203, 213, 61, 57, 74,
							168, 67, 69, 229, 128, 185, 2, 100, 201, 128, 117, 57, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 160, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							253, 105, 228, 93, 111, 81, 228, 130, 172, 79, 143, 46, 20, 242, 21, 82,
							0, 0, 93, 139, 6, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 56, 197, 134, 51, 192, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56, 197,
							134, 51, 192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 56, 197, 134, 51, 192, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56, 197, 134,
							51, 192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 221, 91, 114, 141, 15, 115, 53, 225,
							115, 233, 223, 14, 194, 138, 27, 152, 228, 159, 84, 144, 67, 246, 163,
							74, 17, 27, 161, 247, 5, 126, 30, 1, 243, 98, 134, 218, 191, 139, 161,
							27, 167, 121, 27, 171, 231, 94, 248, 206, 73, 195, 156, 142, 246, 164,
							198, 205, 78, 67, 188, 193, 147, 210, 209, 46, 0, 0, 0, 0, 0, 0, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2,
							1, 56, 204, 92, 213, 109, 169, 231, 44, 75, 130, 19, 30, 79, 248, 50,
							78, 119, 48, 161, 206, 119, 24, 74, 4, 190, 125, 90, 23, 101, 13, 83,
							24, 231, 138, 70, 132, 57, 11, 124, 83, 101, 7, 232, 64, 136, 14, 187,
							52, 224, 220, 104, 8, 215, 48, 44, 207, 203, 144, 38, 231, 116, 87, 208,
							130, 2, 124, 160, 137, 115, 161, 220, 2, 48, 185, 157, 125, 236, 198,
							85, 99, 212, 128, 24, 126, 171, 22, 34, 146, 36, 193, 208, 83, 3, 134,
							11, 74, 38, 89, 252, 160, 37, 222, 4, 59, 169, 237, 144, 64, 12, 82, 61,
							251, 40, 85, 42, 89, 21, 199, 71, 128, 151, 231, 166, 230, 60, 14, 17,
							59, 67, 118, 175, 216,
						],
					},
					paymasterParams: {
						paymaster: '0x0000000000000000000000000000000000000000',
						paymasterInput: [],
					},
				},
			},
			execute: {
				contractAddress: '0xbb5c309a3a9347c0135b93cbd53d394aa84345e5',
				calldata:
					'0xc9807539000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000fd69e45d6f51e482ac4f8f2e14f2155200005d8b0600010203000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000038c58633c000000000000000000000000000000000000000000000000000000038c58633c000000000000000000000000000000000000000000000000000000038c58633c000000000000000000000000000000000000000000000000000000038c58633c00000000000000000000000000000000000000000000000000000000000000002dd5b728d0f7335e173e9df0ec28a1b98e49f549043f6a34a111ba1f7057e1e01f36286dabf8ba11ba7791babe75ef8ce49c39c8ef6a4c6cd4e43bcc193d2d12e00000000000000000000000000000000000000000000000000000000000000020138cc5cd56da9e72c4b82131e4ff8324e7730a1ce77184a04be7d5a17650d5318e78a4684390b7c536507e840880ebb34e0dc6808d7302ccfcb9026e77457d0',
				value: BigInt(0),
			},
			received_timestamp_ms: 1706539720746,
			raw_bytes:
				'0xf902ce826870843b9aca00833d090094bb5c309a3a9347c0135b93cbd53d394aa84345e580b90264c9807539000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000fd69e45d6f51e482ac4f8f2e14f2155200005d8b0600010203000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000038c58633c000000000000000000000000000000000000000000000000000000038c58633c000000000000000000000000000000000000000000000000000000038c58633c000000000000000000000000000000000000000000000000000000038c58633c00000000000000000000000000000000000000000000000000000000000000002dd5b728d0f7335e173e9df0ec28a1b98e49f549043f6a34a111ba1f7057e1e01f36286dabf8ba11ba7791babe75ef8ce49c39c8ef6a4c6cd4e43bcc193d2d12e00000000000000000000000000000000000000000000000000000000000000020138cc5cd56da9e72c4b82131e4ff8324e7730a1ce77184a04be7d5a17650d5318e78a4684390b7c536507e840880ebb34e0dc6808d7302ccfcb9026e77457d082027ca08973a1dc0230b99d7decc65563d480187eab16229224c1d05303860b4a2659fca025de043ba9ed90400c523dfb28552a5915c7478097e7a6e63c0e113b4376afd8',
		},
	],
};

export const getTransactionDetailsData = {
	input: '0x16d5e37b848eed8b33d927b7c3b9d974cc48e164af5f7a6d172334a1330a5e76',
	output: {
		isL1Originated: false,
		status: 'verified',
		fee: BigInt(178163600000000),
		initiatorAddress: '0x202bd724d72fd5a169c8930203e1b60870e4df95',
		receivedAt: '2024-01-29T14:48:40.746Z',
		ethCommitTxHash: '0xb5f033924474cff62a9a14dcdc878e79b1a904db00bd11cfa97b79da4fa96f47',
		ethProveTxHash: '0x74c798d91755df8a2f16556a03cfd0bbf1c54a394e151814608f574869dc1271',
		ethExecuteTxHash: '0x76262eb52a0c82f18bb08393da24d514e44d9c9c3b200504e35c36270e14afe2',
	},
};

export const getBlockDetailsData = {
	input: 1,
	output: {
		number: BigInt(1),
		l1BatchNumber: BigInt(1),
		timestamp: 1701420713,
		l1TxCount: BigInt(4),
		l2TxCount: BigInt(0),
		rootHash: '0x086227fafad2bc4d08a122ebb690d958edcd43352d38d31646968480f496827c',
		status: 'verified',
		commitTxHash: '0xa3d21fcdaea5143c0f87b2f7306bb4c2bc6207e616d5eab6a1a0d24d3ee3a261',
		committedAt: '2023-12-01T09:24:50.901122Z',
		proveTxHash: '0x4ecdd4766654068dbbfdf461854926fb1057f5d1b46b7adcf585bf7c31d4147f',
		provenAt: '2023-12-01T10:16:13.533802Z',
		executeTxHash: '0x115022fc9d09f3a20fff619c0b9e7f009ce9c30533a979cf6384cd5722424cec',
		executedAt: '2023-12-01T10:16:13.608147Z',
	},
};
export const getBridgeContractsData = {
	output: {
		l1Erc20DefaultBridge: '0x2ae09702f77a4940621572fbcdae2382d44a2cba',
		l1WethBridge: '0x0000000000000000000000000000000000000000',
		l2Erc20DefaultBridge: '0x681a1afdc2e06776816386500d2d461a6c96cb45',
		l2WethBridge: '0x0000000000000000000000000000000000000000',
	},
};

export const getL2ToL1LogProofData = {
	input: '0x2a1c6c74b184965c0cb015aae9ea134fd96215d2e4f4979cfec12563295f610e',
	output: {
		proof: [
			'0x8c48910df2ca7de509daf50b3182fcdf2dd6c422c6704054fd857d6c9516d6fc',
			'0xc5028885760b8b596c4fa11497c783752cb3a3fb3b8e6b52d7e54b9f1c63521e',
			'0xeb1f451eb8163723ee19940cf3a8f2a2afdf51100ce8ba25839bd94a057cda16',
			'0x7aabfd367dea2b5306b8071c246b99566dae551a1dbd40da791e66c4f696b236',
			'0xe4733f281f18ba3ea8775dd62d2fcd84011c8c938f16ea5790fd29a03bf8db89',
			'0x1798a1fd9c8fbb818c98cff190daa7cc10b6e5ac9716b4a2649f7c2ebcef2272',
			'0x66d7c5983afe44cf15ea8cf565b34c6c31ff0cb4dd744524f7842b942d08770d',
			'0xb04e5ee349086985f74b73971ce9dfe76bbed95c84906c5dffd96504e1e5396c',
			'0xac506ecb5465659b3a927143f6d724f91d8d9c4bdb2463aee111d9aa869874db',
		],
		id: 0n,
		root: '0x920c63cb0066a08da45f0a9bf934517141bd72d8e5a51421a94b517bf49a0d39',
	},
};
export const getProofData: {
	input: [Address, [HexString], number];
	output: StorageProof;
} = {
	input: [
		'0x0000000000000000000000000000000000008003',
		['0x8b65c0cf1012ea9f393197eb24619fd814379b298b238285649e14f936a5eb12'],
		354895,
	],
	output: {
		address: '0x0000000000000000000000000000000000008003',
		storageProof: [
			{
				key: '0x8b65c0cf1012ea9f393197eb24619fd814379b298b238285649e14f936a5eb12',
				proof: [
					'0xe3e8e49a998b3abf8926f62a5a832d829aadc1b7e059f1ea59ffbab8e11edfb7',
					'0x9bebfa036e85a6ffb6bf447a9c7d41af176642c6aaf5cfbc97128f4f10d8a25a',
					'0xcca89548554c0402d1ad9d40f58357dd63f9a8797312764a7a2117fdf3c3cf27',
					'0xb300d43e85e6985e813e1d6f9231e14e3d0b150a177ca4b84b14f56a40d7460e',
					'0x85d3157d7a7437390e78db2b43ab66f46543ba54bae5a6d4165fc6c0a731369c',
					'0xa76e30d2ea9e9fc1842273540126743c1eed6ebab3468cc0e73ceb48b60bbbc5',
					'0xe870299d2381b56dc3a01dfd12c71662aedffa74686d56b35199352761b7d7e5',
					'0x95ddfc7d513311b3ac273699246ea095495f4155253de3e7d34e0a3643c5fbd8',
					'0x31110aa2a06a06bbc692255235eb69188e9a29d20548057f76f6a3068e1a0506',
					'0x9cfb69d119d1e7a4dc671e99d4ecc8f0cc5a7ed5e2225106949d6ac7d17ba8a2',
					'0x92fe999cb989e97693398f4a6bb7c3db3cb35e256e2a0a3c1bbb6772e2dc8df8',
					'0xaa6feb7cb008ee03c6a3aa05920f4d2258a21aede994c5f190c4828cff12c672',
					'0x1d4e754ebcfe090aa99541027a44622c48faa5aa0ce44e74764296a307f11a9a',
					'0x1618d709ec45a19f4c4decc234965d9d56e5630bfb03de0b8efab3b0d3fdd5c3',
					'0x9eca9d5f3d18e7a7006e1a7dae94756b95b1e498b638a9b16e08a123aafab1fb',
					'0xb270c37699110bb9c32218d5da501b945ecef12cf200f32d606a8b250aa5b13a',
					'0x027f56999d7c97c5ed711f38972ae251bfff9ef450a12024e8680dadfe8d1952',
					'0x67ebd9c0e1dd1e1b8a2039d5a761f99aa16845ba6ced8243dad2cfbf32fd1e35',
					'0x6b349489a60360783e70d701549e8ef90ddab85352e3810c6a70c5c3493c7b58',
					'0xf3f33bc89d6cf6a79aff4fa51cb8d98b0437c0ee49c2c4fcb8745ee4e6478274',
					'0x0269c9296ebf77ac4603fb5040455f88ccacb7f186e56029f209c383d8d4128c',
					'0xa557bd43406ed8e6fedf52a8d5fadd97c4be39ec43862e95b8761cd3f58b89ee',
					'0xc461d0f39807b910e8fa76107e99f99f346a3f3e7faa40343ee2ddf53c4e6b4d',
					'0xf7fd5de13defb75017e587a4c2e58c33f7118f066367868e8a7e5b1ee2800260',
					'0x42c0e6cfbd0f0bc0505538ec04c120a21477c109b0a576247d7d45919d400ede',
					'0x9cb345b482f45358dd0a57afce927d7b85756f6d49c2ae0dc7f7908fb27d3cc2',
					'0x0a39e3389d2437d160f3d95cdf30f61c1afd52a2f82cafd2ac32a6b6ea823e9b',
					'0x9ebd7b37a21fb0c74d0040a941038887caf4e4c7dfaa182b82915cacc6191025',
					'0x4550ab30af8c76557a74d051eb43a964889d383d6da343c6a4f4799595d86f9c',
				],
				value: '0x0000000000000000000000000000000000000000000000000000000000000060',
				index: BigInt(27900957),
			},
		],
	},
};

export const estimateData = {
	input: {
		from: '0x1111111111111111111111111111111111111111',
		to: '0x2222222222222222222222222222222222222222',
		data: '0xffffffff',
	},
};

export const getL1BatchDetailsData = {
	input: 12345,
	output: {
		number: BigInt(12345),
		timestamp: 1681063384,
		l1TxCount: BigInt(9),
		l2TxCount: BigInt(294),
		rootHash: '0x994d2738f7ac89b45c8381a7816307b501c00b3127afc79e440dbf1b3e3b5a8c',
		status: 'verified',
		commitTxHash: '0xe5e76d1e17cff2b7232d40ddf43c245e29c76e5354571aa8083d73e793efb64a',
		committedAt: '2023-04-09T18:05:40.548203Z',
		proveTxHash: '0xe980f58feed22a4dbc46fe0339bfcbc09f51c99b2f3bc4f9f60e710ea5f0a2da',
		provenAt: '2023-04-09T22:51:16.200810Z',
		executeTxHash: '0x19c125a6104f731bcc1ce378f090c808e97c6d634fc32cb786694a94fc8219a1',
		executedAt: '2023-04-10T18:48:25.009708Z',
		l1GasPrice: BigInt(29424338466),
		l2FairGasPrice: BigInt(250000000),
		baseSystemContractsHashes: {
			bootloader: '0x010007793a328ef16cc7086708f7f3292ff9b5eed9e7e539c184228f461bf4ef',
			default_aa: '0x0100067d861e2f5717a12c3e869cfb657793b86bbb0caa05cc1421f16c5217bc',
		},
	},
};
