import {Web3, core} from "web3";
import {ZkSyncPlugin, ZERO_ADDRESS} from "../src";
import config from "../src/hardhat.config";

const EXAMPLE_ERC20_TOKEN = {
    address: "0xF38E1Ce18214DF71f4c2101eefA14dfC98000421",
    l1Address: "0x0000000000000000000000000000000000000000",
    l2Address: '0x6265758E61DBA6869F2645C89694A78138Ae02A1',
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
            web3 = new Web3(config.networks.zkSyncSepoliaTestnet.url);
            web3.registerPlugin(new ZkSyncPlugin());
        });


        it("should get bridge addresses", async () => {
            const res = await web3.zkSync.getDefaultBridgeAddresses();

            expect(res.erc20L1).toBe('0x2ae09702f77a4940621572fbcdae2382d44a2cba')
            expect(res.erc20L2).toBe('0x681a1afdc2e06776816386500d2d461a6c96cb45')
            expect(res.wethL1).toBe('0xfe7d3fe7277523a43267dd910e1bc5d1d7e38668')
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
