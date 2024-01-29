import {Web3, core} from "web3";
import {ZkSyncPlugin, ZERO_ADDRESS} from "../src";

const EXAMPLE_ERC20_TOKEN = {
    address: "0xF38E1Ce18214DF71f4c2101eefA14dfC98000421",
    l1Address: "0x0000000000000000000000000000000000000000",
    l2Address: '0x6A910b989aC7BF30B1C359806F05Eae2992a465D',
    decimals: 18,
}

describe("TemplatePlugin Tests", () => {
    it("should register TemplatePlugin plugin on Web3Context instance", () => {
        const web3Context = new core.Web3Context("http://127.0.0.1:8545");
        web3Context.registerPlugin(new ZkSyncPlugin());
        expect(web3Context.zkSync).toBeDefined();
    });

    describe("TemplatePlugin method tests", () => {
        let web3: Web3;

        beforeAll(() => {
            web3 = new Web3('https://testnet.era.zksync.dev');
            web3.registerPlugin(new ZkSyncPlugin());
        });


        it("should get bridge addresses", async () => {
            const res = await web3.zkSync.getDefaultBridgeAddresses();

            expect(res.erc20L1).toBe('0x927ddfcc55164a59e0f33918d13a2d559bc10ce7')
            expect(res.erc20L2).toBe('0x00ff932a6d70e2b8f1eb4919e1e09c1923e7e57b')
            expect(res.wethL1).toBe('0x0000000000000000000000000000000000000000')
            expect(res.wethL2).toBe('0x0000000000000000000000000000000000000000')
        });
        it("should get L1 token address", async () => {
            const res = await web3.zkSync.getL1Address(EXAMPLE_ERC20_TOKEN.address)

            expect(res).toBe(ZERO_ADDRESS)
        });
        it("should get L2 token address", async () => {
            const res = await web3.zkSync.getL2Address(EXAMPLE_ERC20_TOKEN.address);

            expect(res).toBe(EXAMPLE_ERC20_TOKEN.l2Address)
        });
    });
});
